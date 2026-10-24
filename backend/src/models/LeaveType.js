import mongoose from "mongoose";

export default mongoose.model(
  'LeaveType',
  new mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      annualQuota: { type: Number, default: 0, min: 0 },
      paid: { type: Boolean, default: true }, // unpaid types have no quota limit
    },
    { timestamps: true }
  )
);
