import Employee from "../models/Employee.js";
import SalaryStructure from "../models/SalaryStructure.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import Payslip from "../models/Payslip.js";
import PayrollRun from "../models/PayrollRun.js";
import ApiError from "../utils/ApiError.js";
import { monthRange, todayStr, workingDaysBetween, eachDay, round2 } from "../utils/dates.js";
import { getCompany, getHolidaySet } from "./companyService.js";

// ILLUSTRATIVE tax slabs on annual taxable income (not real tax/legal advice)
const TAX_SLABS = [
  { upTo: 600000, rate: 0 },
  { upTo: 1200000, rate: 0.05 },
  { upTo: 2400000, rate: 0.15 },
  { upTo: Infinity, rate: 0.25 },
];

const annualTax = (annual) => {
  let tax = 0;
  let prev = 0;
  for (const slab of TAX_SLABS) {
    if (annual > prev) tax += (Math.min(annual, slab.upTo) - prev) * slab.rate;
    prev = slab.upTo;
  }
  return tax;
};

// Default structure used by HR UI: gross = 1.5 x basic (HRA 40%, medical 10%)
const defaultAllowances = (basic) => ({ hra: round2(basic * 0.4), medical: round2(basic * 0.1) });

const calculatePayslip = ({ structure, employee, company, monthWorkingDays, window, absentDays, halfDays, unpaidLeaveDays }) => {
  const fullGross = structure.basic + structure.hra + structure.medical + structure.other;
  const monthTotal = monthWorkingDays.length || 1;
  const employedDays = window.length;
  const prorate = employedDays / monthTotal;
  const gross = fullGross * prorate;
  const perDayGross = fullGross / monthTotal;
  const deductions = perDayGross * (absentDays + unpaidLeaveDays + halfDays * 0.5);
  const taxable = Math.max(gross - deductions, 0);
  const tax = annualTax(taxable * 12) / 12;
  const net = Math.max(taxable - tax, 0);
  return {
    workingDays: monthTotal, employedDays, absentDays, halfDays, unpaidLeaveDays,
    fullGross: round2(fullGross), gross: round2(gross), perDayGross: round2(perDayGross),
    deductions: round2(deductions), tax: round2(tax), net: round2(net),
    breakdown: { basic: round2(structure.basic * prorate), hra: round2(structure.hra * prorate), medical: round2(structure.medical * prorate), other: round2(structure.other * prorate) },
  };
};

const buildPayslipForEmployee = async (emp, structure, month, company, holidays, unpaidTypeIds) => {
  const { start, end } = monthRange(month);
  const today = todayStr();
  const monthWorkingDays = workingDaysBetween(start, end, company.weekends, holidays);

  // Employment window inside this month (joining / leaving proration)
  const winStart = emp.joiningDate > start ? emp.joiningDate : start;
  const winEnd = emp.leavingDate && emp.leavingDate < end ? emp.leavingDate : end;
  const window = winStart <= winEnd ? monthWorkingDays.filter((d) => d >= winStart && d <= winEnd) : [];

  const records = await Attendance.find({ employee: emp._id, date: { $gte: start, $lte: end } });
  const recMap = new Map(records.filter((r) => r.checkIn).map((r) => [r.date, r]));
  const leaves = await LeaveRequest.find({ employee: emp._id, status: "approved", startDate: { $lte: end }, endDate: { $gte: start } });

  const paidLeave = new Set();
  const unpaidLeave = new Set();
  leaves.forEach((l) => {
    const target = unpaidTypeIds.has(String(l.leaveType)) ? unpaidLeave : paidLeave;
    eachDay(l.startDate, l.endDate).forEach((d) => target.add(d));
  });

  let absentDays = 0, halfDays = 0, unpaidLeaveDays = 0;
  window.forEach((d) => {
    if (d > today) return; // future days are not judged yet
    if (unpaidLeave.has(d)) unpaidLeaveDays += 1;
    else if (paidLeave.has(d)) return;
    else if (recMap.has(d)) { if (recMap.get(d).status === "half_day") halfDays += 1; }
    else if (d < today) absentDays += 1;
  });

  return calculatePayslip({ structure, employee: emp, company, monthWorkingDays, window, absentDays, halfDays, unpaidLeaveDays });
};

// Create or rebuild a monthly DRAFT. Finalized runs are locked.
const generateDraft = async (month, user) => {
  let run = await PayrollRun.findOne({ month });
  if (run?.status === "finalized") throw new ApiError(400, "This month is finalized and locked");

  const company = await getCompany();
  const { start, end } = monthRange(month);
  const holidays = await getHolidaySet(start, end);
  const unpaid = await LeaveType.find({ paid: false });
  const unpaidTypeIds = new Set(unpaid.map((t) => String(t._id)));

  const employees = await Employee.find({
    joiningDate: { $lte: end },
    $or: [{ leavingDate: { $exists: false } }, { leavingDate: null }, { leavingDate: { $gte: start } }],
  });
  const structures = await SalaryStructure.find({ employee: { $in: employees.map((e) => e._id) } });
  const structMap = new Map(structures.map((s) => [String(s.employee), s]));

  if (!run) run = new PayrollRun({ month, createdBy: user._id });
  await run.save();
  await Payslip.deleteMany({ run: run._id });

  const slips = [];
  for (const emp of employees) {
    const structure = structMap.get(String(emp._id));
    if (!structure) continue; // no salary set yet -> skipped
    const calc = await buildPayslipForEmployee(emp, structure, month, company, holidays, unpaidTypeIds);
    slips.push({ run: run._id, employee: emp._id, month, ...calc });
  }
  if (slips.length) await Payslip.insertMany(slips);

  run.employeeCount = slips.length;
  run.totalGross = round2(slips.reduce((s, p) => s + p.gross, 0));
  run.totalNet = round2(slips.reduce((s, p) => s + p.net, 0));
  await run.save();
  return run;
};

export { generateDraft, defaultAllowances, TAX_SLABS };
