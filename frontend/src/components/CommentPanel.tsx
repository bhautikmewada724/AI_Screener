import { useState } from 'react';

import type { ReviewNote } from '../types/api';

interface CommentPanelProps {
  notes: ReviewNote[];
  loading?: boolean;
  onSubmit: (body: string, visibility: 'shared' | 'private') => Promise<void>;
}

const CommentPanel = ({ notes, loading, onSubmit }: CommentPanelProps) => {
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'shared' | 'private'>('shared');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await onSubmit(body, visibility);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save comment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div>
        <strong>Comments & Collaboration</strong>
        <p className="text-sm text-brand-ash">Coordinate decisions with your HR team.</p>
      </div>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <textarea
          rows={3}
          placeholder="Add a note about this candidate…"
          value={body}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-navy"
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'shared' | 'private')}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-navy"
          >
            <option value="shared">Visible to HR team</option>
            <option value="private">Private</option>
          </select>
          <button className="btn btn-primary w-full sm:w-auto" disabled={saving}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
        {error && <small className="text-sm text-rose-600">{error}</small>}
      </form>

      <div className="max-h-64 space-y-3 overflow-y-auto">
        {loading && <small className="text-brand-ash">Loading comments…</small>}
        {!loading && notes.length === 0 && <small className="text-brand-ash">No comments yet.</small>}
        {notes.map((note) => (
          <article key={note._id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-card-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-navy/10 text-sm font-semibold text-brand-navy">
                {note.authorId?.name?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-brand-navy">{note.authorId?.name || 'Teammate'}</div>
                <small className="text-xs text-brand-ash">{new Date(note.createdAt).toLocaleString()}</small>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-ash">
                {note.visibility}
              </span>
            </div>
            <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-brand-navy">{note.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default CommentPanel;


