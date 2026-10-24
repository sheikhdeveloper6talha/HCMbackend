import mongoose from "mongoose";

export default mongoose.model(
  'Designation',
  new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true } }, { timestamps: true })
);
