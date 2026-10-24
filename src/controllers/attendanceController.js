import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { todayStr, monthRange, isWorkingDay } from "../utils/dates.js";
import * as svc from "../services/attendanceService.js";
import { getCompany, getHolidaySet } from "../services/companyService.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";
import { getPaging, pageMeta } from "../utils/paginate.js";

const needEmployee = (req) => {
  if (!req.user.employee) throw new ApiError(403, "Only employees can do this");
  return req.user.employee;
};

const checkIn = asyncHandler(async (req, res) => {
  const record = await svc.checkIn(needEmployee(req), req.body);
  res.status(201).json({ success: true, message: "Checked in", data: record });
});

const checkOut = asyncHandler(async (req, res) => {
  const record = await svc.checkOut(needEmployee(req), req.body);
  res.json({ success: true, message: "Checked out", data: record });
});

const myCalendar = asyncHandler(async (req, res) => {
  const month = req.query.month || todayStr().slice(0, 7);
  const { start, end } = monthRange(month);
  const days = await svc.getMonthCalendar(needEmployee(req), month, start, end);
  const today = await Attendance.findOne({ employee: req.user.employee, date: todayStr() });
  res.json({ success: true, data: { days, today } });
});

// HR/Admin: calendar of any employee
const employeeCalendar = asyncHandler(async (req, res) => {
  const month = req.query.month || todayStr().slice(0, 7);
  const { start, end } = monthRange(month);
  res.json({ success: true, data: { days: await svc.getMonthCalendar(req.params.id, month, start, end) } });
});

const board = asyncHandler(async (req, res) => {
  const rows = await svc.getBoard(req.query.date || todayStr(), req.query.department);
  res.json({ success: true, data: rows });
});

// Employee asks to fix a day (forgot check-out, wrong time, missed check-in)
const requestCorrection = asyncHandler(async (req, res) => {
  const employeeId = needEmployee(req);
  const { date, checkIn: inTime, checkOut: outTime, reason } = req.body;
  if (date > todayStr()) throw new ApiError(400, "You cannot correct a future date");
  if (!inTime && !outTime) throw new ApiError(400, "Provide a check-in or check-out time");

  const company = await getCompany();
  const holidays = await getHolidaySet(date, date);
  if (!isWorkingDay(date, company.weekends, holidays)) throw new ApiError(400, "That date is not a working day");

  let record = await Attendance.findOne({ employee: employeeId, date });
  if (record?.correction?.status === "pending") throw new ApiError(409, "A correction for this date is already pending");
  if (!record) record = new Attendance({ employee: employeeId, date, status: "absent" });
  record.correction = { checkIn: inTime, checkOut: outTime, reason, status: "pending" };
  await record.save();
  await logAudit(req.user, "request_correction", "Attendance", record._id, null, { date, reason });
  res.status(201).json({ success: true, message: "Correction submitted", data: record });
});

const listCorrections = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaging(req.query);
  const filter = { "correction.status": req.query.status || "pending" };
  const [items, total] = await Promise.all([
    Attendance.find(filter).populate("employee", "name code").sort({ "correction.updatedAt": -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

const myCorrections = asyncHandler(async (req, res) => {
  const items = await Attendance.find({ employee: needEmployee(req), correction: { $exists: true } }).sort({ date: -1 }).limit(20);
  res.json({ success: true, data: items });
});

const decideCorrection = asyncHandler(async (req, res) => {
  const { status, comment } = req.body;
  const record = await Attendance.findById(req.params.id).populate("employee", "user name");
  if (!record?.correction) throw new ApiError(404, "Correction not found");
  if (record.correction.status !== "pending") throw new ApiError(400, "This correction was already decided");
  const before = { status: record.status, checkIn: record.checkIn, checkOut: record.checkOut };

  if (status === "approved") await svc.applyCorrection(record);
  record.correction.status = status;
  record.correction.comment = comment;
  record.correction.decidedBy = req.user._id;
  await record.save();

  await logAudit(req.user, status === "approved" ? "approve" : "reject", "AttendanceCorrection", record._id, before, { status: record.status, date: record.date });
  await notify(record.employee.user, `Attendance correction ${status}`, `Your correction for ${record.date} was ${status}.${comment ? " " + comment : ""}`, "/attendance");
  res.json({ success: true, data: record });
});

export { checkIn, checkOut, myCalendar, employeeCalendar, board, requestCorrection, listCorrections, myCorrections, decideCorrection };
