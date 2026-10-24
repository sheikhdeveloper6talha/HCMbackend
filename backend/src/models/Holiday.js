import mongoose from "mongoose";

export default mongoose.model(
  'Holiday',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    },
    { timestamps: true }
  )
);
