import type { AuditEventRecord } from '../types/api';

interface AuditTimelineProps {
  events: AuditEventRecord[];
  loading?: boolean;
}

const labelForAction = (action: string) => {
  switch (action) {
    case 'status_changed':
      return 'Status updated';
    case 'comment_added':
      return 'Comment added';
    case 'score_refreshed':
      return 'Score refreshed';
    case 'application_submitted':
      return 'Application submitted';
    default:
      return action.replaceAll('_', ' ');
  }
};

const AuditTimeline = ({ events, loading }: AuditTimelineProps) => {
  return (
    <div className="card" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <strong>Audit Trail</strong>
        <p style={{ margin: 0, color: '#94a3b8' }}>Immutable log of workflow actions.</p>
      </div>
      {loading && <small>Loading events…</small>}
      {!loading && events.length === 0 && <small style={{ color: '#94a3b8' }}>No actions recorded yet.</small>}
      <div style={{ display: 'grid', gap: '0.5rem', maxHeight: 250, overflow: 'auto' }}>
        {events.map((event) => (
          <div key={event._id} style={{ borderLeft: '3px solid #0f172a', paddingLeft: '0.75rem' }}>
            <div style={{ fontWeight: 600 }}>{labelForAction(event.action)}</div>
            <small style={{ color: '#94a3b8' }}>
              {event.actorId?.name} · {new Date(event.createdAt).toLocaleString()}
            </small>
            {event.context && (
              <pre style={{ background: '#f1f5f9', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                {JSON.stringify(event.context, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditTimeline;


