import mongoose from "mongoose";

export default mongoose.model(
  'Notification',
  new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      title: { type: String, required: true },
      message: String,
      link: String,
      read: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);
