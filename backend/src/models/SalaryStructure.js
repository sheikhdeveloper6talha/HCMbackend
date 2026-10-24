import mongoose from "mongoose";

export default mongoose.model(
  'SalaryStructure',
  new mongoose.Schema(
    {
      employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
      basic: { type: Number, required: true, min: 0 },
      hra: { type: Number, default: 0, min: 0 },
      medical: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
  )
);
