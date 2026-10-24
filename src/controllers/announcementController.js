import Announcement from "../models/Announcement.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { logAudit } from "../services/auditService.js";

const list = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await Announcement.find().populate("postedBy", "name").sort({ createdAt: -1 }).limit(50) }));

const create = asyncHandler(async (req, res) => {
  const item = await Announcement.create({ title: req.body.title, message: req.body.message, postedBy: req.user._id });
  await logAudit(req.user, "create", "Announcement", item._id, null, { title: item.title });
  res.status(201).json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  const item = await Announcement.findById(req.params.id);
  if (!item) throw new ApiError(404, "Announcement not found");
  await item.deleteOne();
  await logAudit(req.user, "delete", "Announcement", item._id, { title: item.title }, null);
  res.json({ success: true, message: "Deleted" });
});
export { list, create, remove };
