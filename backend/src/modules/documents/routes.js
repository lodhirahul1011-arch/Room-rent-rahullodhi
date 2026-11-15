const r = require('express').Router();
const { z } = require('zod');
const M = require('../../models');
const { auth, roles } = require('../../core/auth');
const { asyncRoute, fail } = require('../../core/errors');
const { parse } = require('../../core/validation');
const storage = require('../../core/private-storage');

r.use(auth);
function org(req) {
  if (!req.actor.organizationId) fail(403, 'Organization required');
  return req.actor.organizationId;
}

r.get('/', asyncRoute(async (req, res) => {
  const q = { organizationId: org(req) };
  if (req.actor.role === 'tenant') {
    if (!req.actor.tenantId) fail(403, 'Tenant not linked');
    q.tenantId = req.actor.tenantId;
  } else if (!['owner', 'manager'].includes(req.actor.role)) fail(403, 'Forbidden');
  res.json({ data: await M.Document.find(q).select('-storageKey').sort({ createdAt: -1 }).limit(500) });
}));

r.patch('/:id/review', roles('owner', 'manager'), asyncRoute(async (req, res) => {
  const b = parse(z.object({ status: z.enum(['approved', 'rejected']), reason: z.string().trim().max(500).optional() }), req.body);
  if (b.status === 'rejected' && (!b.reason || b.reason.length < 4)) fail(400, 'Rejection reason required');
  const d = await M.Document.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), status: 'pending' },
    { $set: { status: b.status, rejectionReason: b.reason || null, reviewedBy: req.actor.id, reviewedAt: new Date() } },
    { new: true },
  );
  if (!d) fail(409, 'Document missing or already reviewed');
  await M.AuditLog.create({ organizationId: org(req), actorId: req.actor.id, event: 'document.reviewed', entityType: 'Document', entityId: String(d.id), details: { status: b.status } });
  res.json({ data: { id: d.id, status: d.status } });
}));

r.patch('/:id/reupload-request', roles('owner', 'manager'), asyncRoute(async (req, res) => {
  const b = parse(z.object({ reason: z.string().trim().min(4).max(500) }), req.body);
  const d = await M.Document.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req) },
    { $set: { status: 'reupload-requested', rejectionReason: b.reason, reviewedBy: req.actor.id, reviewedAt: new Date() } },
    { new: true },
  );
  if (!d) fail(404, 'Document not found');
  await M.AuditLog.create({ organizationId: org(req), actorId: req.actor.id, event: 'document.reupload_requested', entityType: 'Document', entityId: String(d.id), details: { reason: b.reason } });
  res.json({ data: { id: d.id, status: d.status } });
}));

r.patch('/:id', roles('owner', 'manager'), asyncRoute(async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(1).max(200), kind: z.string().trim().min(1).max(40) }), req.body);
  const d = await M.Document.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!d) fail(404, 'Document not found');
  d.name = b.name;
  d.kind = b.kind;
  await d.save();
  if (d.fileAssetId) await M.FileAsset.updateOne({ _id: d.fileAssetId, organizationId: org(req) }, { $set: { originalName: b.name, kind: b.kind } });
  await M.AuditLog.create({ organizationId: org(req), actorId: req.actor.id, event: 'document.updated', entityType: 'Document', entityId: String(d.id), details: b });
  res.json({ data: { id: d.id, name: d.name, kind: d.kind } });
}));

r.delete('/:id', roles('owner', 'manager'), asyncRoute(async (req, res) => {
  const d = await M.Document.findOne({ _id: req.params.id, organizationId: org(req) });
  if (!d) fail(404, 'Document not found');
  const asset = d.fileAssetId ? await M.FileAsset.findOne({ _id: d.fileAssetId, organizationId: org(req) }) : null;
  await d.deleteOne();
  if (asset) {
    await M.FileAsset.deleteOne({ _id: asset.id });
    await storage.remove(asset.storageKey).catch(() => {});
  }
  await M.AuditLog.create({ organizationId: org(req), actorId: req.actor.id, event: 'document.deleted', entityType: 'Document', entityId: String(d.id), details: { name: d.name } });
  res.status(204).end();
}));

module.exports = r;
