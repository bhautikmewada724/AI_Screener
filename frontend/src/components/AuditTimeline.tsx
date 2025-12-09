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
    <div className="card space-y-4">
      <div>
        <strong>Audit Trail</strong>
        <p className="text-sm text-brand-ash">Immutable log of workflow actions.</p>
      </div>
      {loading && <small className="text-brand-ash">Loading events…</small>}
      {!loading && events.length === 0 && <small className="text-brand-ash">No actions recorded yet.</small>}
      <div className="space-y-3 overflow-y-auto">
        {events.map((event) => (
          <div key={event._id} className="relative rounded-2xl border border-slate-100 bg-white p-4 shadow-card-sm">
            <div className="ml-3 border-l-2 border-brand-navy/30 pl-4 text-sm text-brand-navy">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{labelForAction(event.action)}</div>
                <small className="text-brand-ash">{new Date(event.createdAt).toLocaleString()}</small>
              </div>
              <small className="text-xs text-brand-ash">{event.actorId?.name || 'System event'}</small>
              {event.context && (
                <pre className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-brand-ash">
                  {JSON.stringify(event.context, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditTimeline;


