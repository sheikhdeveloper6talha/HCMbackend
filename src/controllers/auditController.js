import AuditLog from "../models/AuditLog.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPaging, pageMeta } from "../utils/paginate.js";

// Read-only: there is intentionally no update or delete endpoint
const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 15);
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = req.query.action;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});
export { list };
