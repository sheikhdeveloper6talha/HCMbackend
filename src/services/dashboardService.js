import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import SalaryStructure from "../models/SalaryStructure.js";
import PayrollRun from "../models/PayrollRun.js";
import Payslip from "../models/Payslip.js";
import AuditLog from "../models/AuditLog.js";
import Announcement from "../models/Announcement.js";
import { todayStr, eachDay, isWorkingDay, round2 } from "../utils/dates.js";
import { getCompany, getHolidaySet } from "./companyService.js";
import { getBalances } from "./leaveService.js";

const shiftDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const gross = (s) => s.basic + s.hra + s.medical + s.other;

const adminDashboard = async ({ department }) => {
  const empFilter = { status: "active", ...(department && { department }) };
  const employees = await Employee.find(empFilter).populate("department", "name");
  const ids = employees.map((e) => e._id);
  const structures = await SalaryStructure.find({ employee: { $in: ids } });
  const structMap = new Map(structures.map((s) => [String(s.employee), s]));

  const yearAgo = shiftDays(todayStr(), -365);
  const left = await Employee.countDocuments({ leavingDate: { $gte: yearAgo }, ...(department && { department }) });
  const headcount = employees.length;
  const attritionRate = headcount + left ? round2((left / (headcount + left)) * 100) : 0;

  const byDept = {};
  employees.forEach((e) => {
    const name = e.department?.name || "Unassigned";
    byDept[name] = byDept[name] || { department: name, headcount: 0, cost: 0 };
    byDept[name].headcount += 1;
    const s = structMap.get(String(e._id));
    if (s) byDept[name].cost += gross(s);
  });

  const totalCost = structures.reduce((sum, s) => sum + gross(s), 0);
  const runs = await PayrollRun.find().sort({ month: -1 }).limit(6);
  const recentAudit = await AuditLog.find().sort({ createdAt: -1 }).limit(8);

  return {
    headcount, left, attritionRate,
    monthlyPayrollCost: round2(totalCost),
    averageSalary: structures.length ? round2(totalCost / structures.length) : 0,
    departments: Object.values(byDept).map((d) => ({ ...d, cost: round2(d.cost) })),
    payrollTrend: runs.reverse().map((r) => ({ month: r.month, gross: r.totalGross, net: r.totalNet, status: r.status })),
    recentAudit,
  };
};

const hrDashboard = async ({ from, to, department }) => {
  const company = await getCompany();
  const today = todayStr();
  const end = to || today;
  const start = from || shiftDays(end, -6);
  const days = eachDay(start, end).slice(-31); // keep charts readable
  const holidays = await getHolidaySet(start, end);

  const empFilter = { status: "active", ...(department && { department }) };
  const employees = await Employee.find(empFilter);
  const ids = employees.map((e) => e._id);
  const records = await Attendance.find({ employee: { $in: ids }, date: { $gte: start, $lte: end }, checkIn: { $exists: true } });
  const leaves = await LeaveRequest.find({ employee: { $in: ids }, status: "approved", startDate: { $lte: end }, endDate: { $gte: start } }).populate("leaveType", "name");

  const trend = days.map((date) => {
    const working = isWorkingDay(date, company.weekends, holidays);
    const dayRecs = records.filter((r) => r.date === date);
    const present = dayRecs.length;
    const late = dayRecs.filter((r) => r.status === "late").length;
    const onLeave = leaves.filter((l) => l.startDate <= date && l.endDate >= date).length;
    const expected = working ? employees.filter((e) => e.joiningDate <= date).length : 0;
    const absent = working && date < today ? Math.max(expected - present - onLeave, 0) : 0;
    return { date, working, present, late, onLeave, absent };
  });

  const countedDays = trend.filter((t) => t.working && t.date < today);
  const expectedTotal = countedDays.reduce((s, t) => s + t.present + t.onLeave + t.absent, 0);
  const absenteeismRate = expectedTotal ? round2((countedDays.reduce((s, t) => s + t.absent, 0) / expectedTotal) * 100) : 0;

  // Leave days used per type inside the range
  const usage = {};
  leaves.forEach((l) => {
    const overlap = eachDay(l.startDate > start ? l.startDate : start, l.endDate < end ? l.endDate : end)
      .filter((d) => isWorkingDay(d, company.weekends, holidays)).length;
    const name = l.leaveType?.name || "Other";
    usage[name] = (usage[name] || 0) + overlap;
  });

  const todayRecs = await Attendance.find({ employee: { $in: ids }, date: today, checkIn: { $exists: true } });
  const onLeaveToday = await LeaveRequest.countDocuments({ employee: { $in: ids }, status: "approved", startDate: { $lte: today }, endDate: { $gte: today } });
  const pendingLeaves = await LeaveRequest.countDocuments({ status: "pending" });
  const pendingCorrections = await Attendance.countDocuments({ "correction.status": "pending" });

  return {
    totalEmployees: employees.length,
    presentToday: todayRecs.length,
    lateToday: todayRecs.filter((r) => r.status === "late").length,
    onLeaveToday,
    pendingApprovals: pendingLeaves + pendingCorrections,
    pendingLeaves, pendingCorrections,
    absenteeismRate, trend,
    leaveUsage: Object.entries(usage).map(([name, days]) => ({ name, days })),
    range: { start, end },
  };
};

const employeeDashboard = async (employeeId) => {
  const today = todayStr();
  const month = today.slice(0, 7);
  const weekAgo = shiftDays(today, -6);
  const monthRecs = await Attendance.find({ employee: employeeId, date: { $gte: `${month}-01`, $lte: `${month}-31` }, checkIn: { $exists: true } });
  const weekRecs = await Attendance.find({ employee: employeeId, date: { $gte: weekAgo, $lte: today } });
  const todayRec = await Attendance.findOne({ employee: employeeId, date: today });
  const finalRuns = await PayrollRun.find({ status: "finalized" }).select("_id");
  const latestPayslip = await Payslip.findOne({ employee: employeeId, run: { $in: finalRuns.map((r) => r._id) } }).sort({ month: -1 });
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(3);

  return {
    today: todayRec,
    daysPresentThisMonth: monthRecs.length,
    lateCount: monthRecs.filter((r) => r.status === "late").length,
    weeklyHours: round2(weekRecs.reduce((s, r) => s + (r.workedHours || 0), 0)),
    leaveBalances: await getBalances(employeeId, today.slice(0, 4)),
    latestPayslip,
    announcements,
  };
};

export { adminDashboard, hrDashboard, employeeDashboard };
