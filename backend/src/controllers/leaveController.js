import LeaveRequest from "../models/LeaveRequest.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { todayStr } from "../utils/dates.js";
import { getBalances, validateRequest } from "../services/leaveService.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { getPaging, pageMeta } from "../utils/paginate.js";

const needEmployee = (req) => {
  if (!req.user.employee) throw new ApiError(403, "Only employees can do this");
  return req.user.employee;
};

const myBalance = asyncHandler(async (req, res) => {
  const year = req.query.year || todayStr().slice(0, 4);
  res.json({ success: true, data: await getBalances(needEmployee(req), year) });
});

const myLeaves = asyncHandler(async (req, res) => {
  const items = await LeaveRequest.find({ employee: needEmployee(req) }).populate("leaveType", "name").sort({ startDate: -1 });
  res.json({ success: true, data: items });
});

const applyLeave = asyncHandler(async (req, res) => {
  const employee = needEmployee(req);
  const { leaveType, startDate, endDate, reason } = req.body;
  const days = await validateRequest(employee, { leaveType, startDate, endDate });
  const leave = await LeaveRequest.create({ employee, leaveType, startDate, endDate, days, reason });
  await logAudit(req.user, "apply", "LeaveRequest", leave._id, null, { startDate, endDate, days });
  res.status(201).json({ success: true, message: "Leave request submitted", data: leave });
});

const cancelLeave = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, employee: needEmployee(req) }); // own requests only
  if (!leave) throw new ApiError(404, "Leave request not found");
  if (!["pending", "approved"].includes(leave.status)) throw new ApiError(400, `A ${leave.status} request cannot be cancelled`);
  if (leave.status === "approved" && leave.startDate <= todayStr()) throw new ApiError(400, "Leave that already started cannot be cancelled");
  const before = { status: leave.status };
  leave.status = "cancelled";
  await leave.save();
  await logAudit(req.user, "cancel", "LeaveRequest", leave._id, before, { status: "cancelled" });
  res.json({ success: true, data: leave });
});

const listLeaves = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaging(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employee) filter.employee = req.query.employee;
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).populate("employee", "name code").populate("leaveType", "name").sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

const decideLeave = asyncHandler(async (req, res) => {
  const { status, comment } = req.body;
  const leave = await LeaveRequest.findById(req.params.id).populate("employee", "user name");
  if (!leave) throw new ApiError(404, "Leave request not found");
  if (leave.status !== "pending") throw new ApiError(400, `This request is already ${leave.status}`);
  if (status === "approved") await validateRequest(leave.employee._id, leave, leave._id); // re-check overlap and quota
  const before = { status: leave.status };
  leave.status = status;
  leave.comment = comment;
  leave.decidedBy = req.user._id;
  await leave.save();
  await logAudit(req.user, status === "approved" ? "approve" : "reject", "LeaveRequest", leave._id, before, { status, comment });
  await notify(leave.employee.user, `Leave ${status}`, `Your leave ${leave.startDate} to ${leave.endDate} was ${status}.${comment ? " " + comment : ""}`, "/leave");
  res.json({ success: true, data: leave });
});

export { myBalance, myLeaves, applyLeave, cancelLeave, listLeaves, decideLeave };
