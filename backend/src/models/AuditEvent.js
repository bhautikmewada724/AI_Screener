import mongoose from 'mongoose';

/**
 * Immutable record of workflow actions for compliance and debugging.
 */
const { Schema } = mongoose;

const auditEventSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      index: true
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      required: true
    },
    before: {
      type: Map,
      of: Schema.Types.Mixed,
      default: undefined
    },
    after: {
      type: Map,
      of: Schema.Types.Mixed,
      default: undefined
    },
    context: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => ({})
    }
  },
  {
    timestamps: true,
    collection: 'audit_events'
  }
);

auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ targetUserId: 1, createdAt: -1 });

const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);

export default AuditEvent;


