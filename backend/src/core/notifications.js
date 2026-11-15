const M = require('../models');

async function send(organizationId, userIds, notice, session) {
  const docs = [...new Set(userIds.map((id) => String(id)).filter(Boolean))].map((userId) => ({
    organizationId,
    userId,
    type: notice.type,
    title: notice.title,
    body: notice.body,
    ...(notice.relatedInvoiceId ? { relatedInvoiceId: notice.relatedInvoiceId } : {}),
  }));
  if (docs.length) await M.Notification.create(docs, session ? { session, ordered: true } : { ordered: true });
}

async function notifyOrganizationRole(organizationId, roles, notice, session) {
  const memberships = await M.Membership.find({ organizationId, role: { $in: roles }, active: true })
    .select('userId').session(session || null);
  return send(organizationId, memberships.map((membership) => membership.userId), notice, session);
}

async function notifyTenant(organizationId, tenantId, notice, session) {
  const tenant = await M.Tenant.findOne({ organizationId, _id: tenantId }).select('userId').session(session || null);
  if (tenant?.userId) return send(organizationId, [tenant.userId], notice, session);
}

module.exports = { notifyOrganizationRole, notifyTenant };
