import PDFDocument from "pdfkit";
import PayrollRun from "../models/PayrollRun.js";
import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import Employee from "../models/Employee.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { generateDraft, TAX_SLABS } from "../services/payrollService.js";
import { logAudit } from "../services/auditService.js";
import { notifyMany } from "../services/notificationService.js";
import { getCompany } from "../services/companyService.js";

const listRuns = asyncHandler(async (req, res) => res.json({ success: true, data: await PayrollRun.find().sort({ month: -1 }) }));

const createRun = asyncHandler(async (req, res) => {
  const run = await generateDraft(req.body.month, req.user);
  await logAudit(req.user, "generate_draft", "PayrollRun", run._id, null, { month: run.month, employees: run.employeeCount });
  res.status(201).json({ success: true, data: run });
});

const getRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw new ApiError(404, "Payroll run not found");
  const payslips = await Payslip.find({ run: run._id }).populate("employee", "name code").sort("month");
  res.json({ success: true, data: { run, payslips, taxSlabs: TAX_SLABS.map((s) => ({ ...s, upTo: Number.isFinite(s.upTo) ? s.upTo : null })) } });
});

// Only Admin can finalize; once finalized the run and its payslips are locked
const finalizeRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw new ApiError(404, "Payroll run not found");
  if (run.status === "finalized") throw new ApiError(400, "Payroll is already finalized");
  if (!run.employeeCount) throw new ApiError(400, "Cannot finalize an empty payroll");
  run.status = "finalized";
  run.finalizedBy = req.user._id;
  run.finalizedAt = new Date();
  await run.save();
  await logAudit(req.user, "finalize", "PayrollRun", run._id, { status: "draft" }, { status: "finalized", month: run.month });

  const slips = await Payslip.find({ run: run._id }).populate("employee", "user");
  await notifyMany(slips.map((s) => s.employee.user), "Payslip available", `Your payslip for ${run.month} is ready to download.`, "/payslips");
  res.json({ success: true, data: run });
});

const listSalaries = asyncHandler(async (req, res) => {
  const employees = await Employee.find({ status: "active" }).populate("department", "name").sort("name");
  const structures = await SalaryStructure.find({ employee: { $in: employees.map((e) => e._id) } });
  const map = new Map(structures.map((s) => [String(s.employee), s]));
  res.json({ success: true, data: employees.map((e) => ({ employee: e, salary: map.get(String(e._id)) || null })) });
});

const setSalary = asyncHandler(async (req, res) => {
  const { basic, hra, medical, other } = req.body;
  if (!(await Employee.exists({ _id: req.params.employeeId }))) throw new ApiError(404, "Employee not found");
  const existing = await SalaryStructure.findOne({ employee: req.params.employeeId });
  const values = { basic: Number(basic), hra: Number(hra || 0), medical: Number(medical || 0), other: Number(other || 0) };
  const salary = await SalaryStructure.findOneAndUpdate({ employee: req.params.employeeId }, values, { upsert: true, new: true, runValidators: true });
  await logAudit(req.user, existing ? "update" : "create", "SalaryStructure", salary._id, existing?.toObject(), values);
  res.json({ success: true, data: salary });
});

// Employees only see payslips from finalized runs
const myPayslips = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(403, "Only employees have payslips");
  const finalRuns = await PayrollRun.find({ status: "finalized" }).select("_id");
  const items = await Payslip.find({ employee: req.user.employee, run: { $in: finalRuns.map((r) => r._id) } }).sort({ month: -1 });
  res.json({ success: true, data: items });
});

const payslipPdf = asyncHandler(async (req, res) => {
  const slip = await Payslip.findById(req.params.id).populate({ path: "employee", populate: [{ path: "department", select: "name" }, { path: "designation", select: "name" }] }).populate("run", "status");
  if (!slip) throw new ApiError(404, "Payslip not found");
  if (req.user.role === "employee") {
    if (String(slip.employee._id) !== String(req.user.employee) || slip.run.status !== "finalized") throw new ApiError(403, "You cannot access this payslip");
  }
  const company = await getCompany();
  const money = (n) => `${company.currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=payslip-${slip.month}-${slip.employee.code}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text(company.name, { align: "left" });
  doc.fontSize(12).fillColor("#555").text(`Payslip for ${slip.month}${slip.run.status === "draft" ? " (DRAFT)" : ""}`).moveDown();
  doc.fillColor("#000").fontSize(11);
  doc.text(`Employee: ${slip.employee.name} (${slip.employee.code})`);
  doc.text(`Department: ${slip.employee.department?.name || "-"}   Designation: ${slip.employee.designation?.name || "-"}`).moveDown();

  const line = (label, value, bold) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(label, 50, doc.y, { continued: true, width: 300 }).text(value, { align: "right" });
  };
  doc.font("Helvetica-Bold").text("Earnings").moveDown(0.3);
  line("Basic", money(slip.breakdown.basic));
  line("House rent allowance", money(slip.breakdown.hra));
  line("Medical allowance", money(slip.breakdown.medical));
  line("Other allowance", money(slip.breakdown.other));
  line("Gross salary", money(slip.gross), true);
  doc.moveDown().font("Helvetica-Bold").text("Deductions").moveDown(0.3);
  line(`Absent (${slip.absentDays} d), unpaid leave (${slip.unpaidLeaveDays} d), half days (${slip.halfDays})`, money(slip.deductions));
  line("Income tax (illustrative)", money(slip.tax));
  doc.moveDown();
  line("NET SALARY", money(slip.net), true);
  doc.moveDown().font("Helvetica").fontSize(9).fillColor("#666").text(`Working days: ${slip.workingDays}. Days employed in month: ${slip.employedDays}. Tax slabs are illustrative only, not tax advice.`);
  doc.end();
});

export { listRuns, createRun, getRun, finalizeRun, listSalaries, setSalary, myPayslips, payslipPdf };
