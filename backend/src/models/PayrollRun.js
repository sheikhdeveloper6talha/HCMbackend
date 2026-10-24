import mongoose from "mongoose";

export default mongoose.model(
  'PayrollRun',
  new mongoose.Schema(
    {
      month: { type: String, required: true, unique: true }, // YYYY-MM
      status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
      totalGross: { type: Number, default: 0 },
      totalNet: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      finalizedAt: Date,
    },
    { timestamps: true }
  )
);
