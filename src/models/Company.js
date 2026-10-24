import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    officeStart: { type: String, default: '09:00' }, // HH:mm
    graceMinutes: { type: Number, default: 15 },
    halfDayHours: { type: Number, default: 5 },
    weekends: { type: [Number], default: [0, 6] }, // 0 = Sunday ... 6 = Saturday
    locationRequired: { type: Boolean, default: false },
    officeLat: Number,
    officeLng: Number,
    radiusMeters: { type: Number, default: 150 },
    currency: { type: String, default: 'PKR' },
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);
