import mongoose from "mongoose";

export default mongoose.model(
  'Announcement',
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      message: { type: String, required: true, trim: true },
      postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
  )
);
