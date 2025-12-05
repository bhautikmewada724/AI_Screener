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
    <div className="card" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <strong>Comments & Collaboration</strong>
        <p style={{ margin: 0, color: '#94a3b8' }}>Coordinate decisions with your HR team.</p>
      </div>
      <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.75rem' }}>
        <textarea
          rows={3}
          placeholder="Add a note about this candidate…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          style={{ width: '100%', borderRadius: '0.75rem', border: '1px solid #cbd5f5', padding: '0.75rem' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'shared' | 'private')}
            style={{ flex: 1, borderRadius: '0.75rem', padding: '0.5rem', border: '1px solid #cbd5f5' }}
          >
            <option value="shared">Visible to HR team</option>
            <option value="private">Private</option>
          </select>
          <button className="btn" style={{ background: '#0f172a', color: '#fff' }} disabled={saving}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
        {error && <small style={{ color: '#b91c1c' }}>{error}</small>}
      </form>

      <div style={{ maxHeight: 250, overflow: 'auto', display: 'grid', gap: '0.75rem' }}>
        {loading && <small>Loading comments…</small>}
        {!loading && notes.length === 0 && <small style={{ color: '#94a3b8' }}>No comments yet.</small>}
        {notes.map((note) => (
          <div key={note._id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>{note.authorId?.name}</div>
              <small style={{ color: '#94a3b8' }}>{new Date(note.createdAt).toLocaleString()}</small>
            </div>
            <p style={{ marginTop: '0.25rem' }}>{note.body}</p>
            <small style={{ color: '#64748b', textTransform: 'capitalize' }}>{note.visibility}</small>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentPanel;


