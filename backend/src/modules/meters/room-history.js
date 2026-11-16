const r = require("express").Router(),
  { isValidObjectId } = require("mongoose"),
  M = require("../../models");
const { auth } = require("../../core/auth"),
  { asyncRoute, fail } = require("../../core/errors");
r.use(auth);
r.get(
  "/:roomId/electricity-history",
  asyncRoute(async (req, res) => {
    if (!req.actor.organizationId) fail(403, req.actor.role === "tenant" ? "Tenant login is not linked to a tenant profile yet. Ask the property owner to link this login from the Tenant directory." : "Membership required");
    if (!isValidObjectId(req.params.roomId)) fail(400, "Invalid room ID");
    const q = {
      organizationId: req.actor.organizationId,
      roomId: req.params.roomId,
    };
    if (req.actor.role === "tenant") {
      q.tenantId = req.actor.tenantId;
      q.status = { $in: ["finalized", "correction"] };
    } else if (!["owner", "manager"].includes(req.actor.role))
      fail(403, "Forbidden");
    res.json({
      data: await M.MeterReading.find(q).sort({ month: -1 }).limit(500),
    });
  }),
);
module.exports = r;
