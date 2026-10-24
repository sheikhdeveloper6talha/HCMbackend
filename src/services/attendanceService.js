import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ApiError from "../utils/ApiError.js";
import { todayStr, eachDay, isWorkingDay, round2 } from "../utils/dates.js";
import { getCompany, getHolidaySet } from "./companyService.js";

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

// Work out the status from times and company rules (server side only)
const computeStatus = (company, checkIn, checkOut) => {
  if (!checkIn) return { status: "absent", workedHours: 0 };
  const lateAfter = toMinutes(company.officeStart) + company.graceMinutes;
  let status = minutesOfDay(checkIn) > lateAfter ? "late" : "present";
  let workedHours = 0;
  if (checkOut) {
    workedHours = round2((checkOut - checkIn) / 3600000);
    if (workedHours < company.halfDayHours) status = "half_day";
  }
  return { status, workedHours };
};

// Adds the "missing_checkout" display status for past days with no check-out
const displayStatus = (record, today) =>
  record.checkIn && !record.checkOut && record.date < today ? "missing_checkout" : record.status;

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const assertLocation = (company, body) => {
  if (!company.locationRequired || company.officeLat == null) return;
  const { lat, lng } = body;
  if (lat == null || lng == null) throw new ApiError(400, "Location is required to check in or out");
  const d = distanceMeters(company.officeLat, company.officeLng, Number(lat), Number(lng));
  if (d > company.radiusMeters) throw new ApiError(400, `You are ${Math.round(d)} m from the office (limit ${company.radiusMeters} m)`);
};

const checkIn = async (employeeId, body) => {
  const company = await getCompany();
  const today = todayStr();
  const holidays = await getHolidaySet(today, today);
  if (!isWorkingDay(today, company.weekends, holidays)) throw new ApiError(400, "Today is not a working day");
  const onLeave = await LeaveRequest.exists({ employee: employeeId, status: "approved", startDate: { $lte: today }, endDate: { $gte: today } });
  if (onLeave) throw new ApiError(400, "You are on approved leave today");
  assertLocation(company, body);

  const existing = await Attendance.findOne({ employee: employeeId, date: today });
  if (existing?.checkIn) throw new ApiError(409, "You have already checked in today");

  const now = new Date(); // server timestamp, never from the client
  const { status } = computeStatus(company, now, null);
  if (existing) {
    existing.checkIn = now;
    existing.status = status;
    return existing.save();
  }
  return Attendance.create({ employee: employeeId, date: today, checkIn: now, status });
};

const checkOut = async (employeeId, body) => {
  const company = await getCompany();
  assertLocation(company, body);
  const record = await Attendance.findOne({ employee: employeeId, date: todayStr() });
  if (!record?.checkIn) throw new ApiError(400, "You have not checked in today");
  if (record.checkOut) throw new ApiError(409, "You have already checked out today");
  record.checkOut = new Date();
  Object.assign(record, computeStatus(company, record.checkIn, record.checkOut));
  return record.save();
};

const buildDate = (date, hhmm) => new Date(`${date}T${hhmm}:00`);

// HR approves a correction -> apply requested times and recompute status
const applyCorrection = async (record) => {
  const company = await getCompany();
  const c = record.correction;
  const checkInAt = c.checkIn ? buildDate(record.date, c.checkIn) : record.checkIn;
  const checkOutAt = c.checkOut ? buildDate(record.date, c.checkOut) : record.checkOut;
  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) throw new ApiError(400, "Corrected check-out must be after check-in");
  record.checkIn = checkInAt;
  record.checkOut = checkOutAt;
  Object.assign(record, computeStatus(company, checkInAt, checkOutAt));
};

// Daily board for HR: every active employee with a status for the date
const getBoard = async (date, departmentId) => {
  const company = await getCompany();
  const today = todayStr();
  const holidays = await getHolidaySet(date, date);
  const working = isWorkingDay(date, company.weekends, holidays);

  const filter = { status: "active", joiningDate: { $lte: date } };
  if (departmentId) filter.department = departmentId;
  const employees = await Employee.find(filter).populate("department", "name").sort("name");
  const ids = employees.map((e) => e._id);
  const records = await Attendance.find({ employee: { $in: ids }, date });
  const leaves = await LeaveRequest.find({ employee: { $in: ids }, status: "approved", startDate: { $lte: date }, endDate: { $gte: date } });
  const recMap = new Map(records.map((r) => [String(r.employee), r]));
  const leaveSet = new Set(leaves.map((l) => String(l.employee)));

  return employees.map((e) => {
    const r = recMap.get(String(e._id));
    let status;
    if (r?.checkIn) status = displayStatus(r, today);
    else if (leaveSet.has(String(e._id))) status = "on_leave";
    else if (!working) status = "off_day";
    else status = date > today ? "upcoming" : "absent";
    return {
      employee: { _id: e._id, name: e.name, code: e.code, department: e.department?.name },
      checkIn: r?.checkIn, checkOut: r?.checkOut, workedHours: r?.workedHours || 0, status,
    };
  });
};

// Month calendar for one employee
const getMonthCalendar = async (employeeId, month, start, end) => {
  const company = await getCompany();
  const today = todayStr();
  const holidays = await getHolidaySet(start, end);
  const emp = await Employee.findById(employeeId);
  const records = await Attendance.find({ employee: employeeId, date: { $gte: start, $lte: end } });
  const leaves = await LeaveRequest.find({ employee: employeeId, status: "approved", startDate: { $lte: end }, endDate: { $gte: start } });
  const recMap = new Map(records.map((r) => [r.date, r]));
  const leaveDays = new Set(leaves.flatMap((l) => eachDay(l.startDate, l.endDate)));

  return eachDay(start, end).map((date) => {
    const r = recMap.get(date);
    let status;
    if (r?.checkIn) status = displayStatus(r, today);
    else if (!isWorkingDay(date, company.weekends, holidays)) status = "off_day";
    else if (leaveDays.has(date)) status = "on_leave";
    else if (date > today || date < emp.joiningDate) status = "none";
    else if (date === today) status = "none";
    else status = "absent";
    return { date, status, checkIn: r?.checkIn, checkOut: r?.checkOut, workedHours: r?.workedHours || 0, correction: r?.correction };
  });
};

export { checkIn, checkOut, applyCorrection, getBoard, getMonthCalendar, displayStatus, computeStatus };
