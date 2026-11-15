const r = require('express').Router();
const multer = require('multer');
const M = require('../../models');
const { auth } = require('../../core/auth');
const { asyncRoute, fail } = require('../../core/errors');
const rules = require('../../core/b5-rules');
const storage = require('../../core/private-storage');
const { notifyOrganizationRole } = require('../../core/notifications');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 } });
r.use(auth);
function org(req) {
  if (!req.actor.organizationId) fail(403, 'Active organization required');
  return req.actor.organizationId;
}

r.post('/documents/:tenantId', upload.single('file'), asyncRoute(async (req, res) => {
  const organizationId = org(req);
  const tenant = await M.Tenant.findOne({ _id: req.params.tenantId, organizationId });
  if (!tenant) fail(404, 'Tenant not found');
  if (req.actor.role === 'tenant' && String(req.actor.tenantId) !== String(tenant.id)) fail(403, 'Tenant access denied');
  if (!['tenant', 'owner', 'manager'].includes(req.actor.role)) fail(403, 'Forbidden');
  if (!req.file || !rules.validUpload(req.file.buffer, req.file.mimetype)) fail(400, 'Unsupported or invalid PDF, PNG or JPEG (max 10 MB)');

  let replacement = null;
  if (req.body.documentId) {
    if (req.actor.role !== 'tenant') fail(403, 'Only the tenant can submit a requested replacement');
    replacement = await M.Document.findOne({ _id: req.body.documentId, tenantId: tenant.id, organizationId, status: 'reupload-requested' });
    if (!replacement) fail(409, 'This document does not have an active re-upload request');
  }

  const key = await storage.write(req.file.buffer, { mime: req.file.mimetype });
  let asset;
  try {
    asset = await M.FileAsset.create({ organizationId, ownerUserId: req.actor.id, relatedType: 'tenant', relatedId: String(tenant.id), tenantId: tenant.id, kind: String(req.body.kind || replacement?.kind || 'identity').slice(0, 40), originalName: rules.safeFilename(req.file.originalname), mime: req.file.mimetype, size: req.file.size, sha256: rules.hash(req.file.buffer), storageKey: key, createdBy: req.actor.id });
    if (replacement) {
      const prior = replacement.fileAssetId ? await M.FileAsset.findOne({ _id: replacement.fileAssetId, organizationId }) : null;
      replacement.fileAssetId = asset.id;
      replacement.name = asset.originalName;
      replacement.kind = asset.kind;
      replacement.storageKey = key;
      replacement.status = 'pending';
      replacement.rejectionReason = null;
      replacement.reviewedBy = null;
      replacement.reviewedAt = null;
      await replacement.save();
      if (prior) {
        await M.FileAsset.deleteOne({ _id: prior.id });
        await storage.remove(prior.storageKey).catch(() => {});
      }
    } else {
      await M.Document.create({ organizationId, tenantId: tenant.id, fileAssetId: asset.id, name: asset.originalName, kind: asset.kind, storageKey: key, status: 'pending' });
    }
  } catch (err) {
    if (asset) await M.FileAsset.deleteOne({ _id: asset.id }).catch(() => {});
    await storage.remove(key).catch(() => {});
    throw err;
  }
  if (req.actor.role === 'tenant') await notifyOrganizationRole(organizationId, ['owner', 'manager'], { type: 'document', title: 'New tenant document', body: `${tenant.name} uploaded ${asset.originalName}.` });
  res.status(201).json({ data: { id: replacement?.id || asset.id, name: asset.originalName, mime: asset.mime, size: asset.size } });
}));

r.get('/:id/download', asyncRoute(async (req, res) => {
  const asset = await M.FileAsset.findById(req.params.id);
  let allowed = asset && rules.recipientPermission(req.actor, asset);
  if (asset && asset.relatedType === 'enrollment' && req.actor.role === 'tenant') allowed = !!await M.Enrollment.exists({ _id: asset.relatedId, organizationId: asset.organizationId, applicantUserId: req.actor.id });
  if (!asset || !allowed) fail(404, 'File not found');
  if (asset.kind === 'meter-photo') await require('../meters/service').authorizedPhoto(req.actor, asset.relatedId, asset.id);
  const data = await storage.read(asset.storageKey);
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Type', asset.mime);
  res.set('Content-Disposition', rules.contentDisposition(asset.originalName, req.query.inline === '1'));
  res.send(data);
}));

module.exports = r;
