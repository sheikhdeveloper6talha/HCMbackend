import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    run: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true },
    workingDays: Number,
    employedDays: Number, // working days inside the employment window (proration)
    absentDays: Number,
    halfDays: Number,
    unpaidLeaveDays: Number,
    fullGross: Number, // monthly gross before proration
    gross: Number, // prorated gross
    perDayGross: Number,
    deductions: Number,
    tax: Number,
    net: Number,
    breakdown: { basic: Number, hra: Number, medical: Number, other: Number },
  },
  { timestamps: true }
);

payslipSchema.index({ run: 1, employee: 1 }, { unique: true });
export default mongoose.model('Payslip', payslipSchema);
