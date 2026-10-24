import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Audit entries are append-only: block any update/delete done through Mongoose
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'].forEach((op) => {
  auditSchema.pre(op, function () {
    throw new Error('Audit log entries cannot be changed or deleted');
  });
});

export default mongoose.model('AuditLog', auditSchema);
