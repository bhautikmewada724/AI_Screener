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
      required: true,
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

const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);

export default AuditEvent;


