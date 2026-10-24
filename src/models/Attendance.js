import mongoose from "mongoose";

const correctionSchema = new mongoose.Schema(
  {
    checkIn: String, // HH:mm requested
    checkOut: String,
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    comment: String,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false, timestamps: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    checkIn: Date,
    checkOut: Date,
    status: { type: String, enum: ['present', 'late', 'half_day', 'absent'], default: 'present' },
    workedHours: { type: Number, default: 0 },
    correction: correctionSchema,
  },
  { timestamps: true }
);

// Only one record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
