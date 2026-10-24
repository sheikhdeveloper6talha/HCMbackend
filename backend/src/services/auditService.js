import AuditLog from "../models/AuditLog.js";

// Fire-and-forget safe: audit failures should never break the main action
const logAudit = async (user, action, entity, entityId, before, after) => {
  try {
    await AuditLog.create({
      actor: user?._id,
      actorName: user?.name,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      before,
      after,
    });
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
};
export { logAudit };
