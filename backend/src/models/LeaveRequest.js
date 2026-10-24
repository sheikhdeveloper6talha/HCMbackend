import mongoose from "mongoose";

export default mongoose.model(
  'LeaveRequest',
  new mongoose.Schema(
    {
      employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
      leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
      startDate: { type: String, required: true },
      endDate: { type: String, required: true },
      days: { type: Number, required: true }, // working days only
      reason: { type: String, trim: true },
      status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
      comment: String,
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
  )
);
