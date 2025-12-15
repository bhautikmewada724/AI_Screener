import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { fetchPreferences, updatePreferences } from '../api/notifications';
import { useAuth } from '../hooks/useAuth';
import type { NotificationPreference } from '../types/api';

const defaultPref = (): NotificationPreference => ({
  typePattern: '*',
  inAppEnabled: true,
  emailEnabled: true,
  digestMode: 'instant',
  quietHours: null
});

const NotificationPreferencesPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<NotificationPreference[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => fetchPreferences(token),
    enabled: Boolean(token),
    onSuccess: (res) => setDrafts(res.preferences?.length ? res.preferences : [defaultPref()])
  });

  const mutation = useMutation({
    mutationFn: (prefs: NotificationPreference[]) => updatePreferences(prefs, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    }
  });

  const rows = useMemo(() => drafts, [drafts]);

  const updateRow = (index: number, updater: (pref: NotificationPreference) => NotificationPreference) => {
    setDrafts((prev) => prev.map((p, i) => (i === index ? updater(p) : p)));
  };

  const addRow = () => setDrafts((prev) => [...prev, defaultPref()]);

  const handleSave = () => mutation.mutate(drafts);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">Notification Preferences</h1>
          <p className="text-sm text-brand-ash">Control which channels you receive per category or type pattern.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={mutation.isLoading}>
          Save preferences
        </button>
      </div>

      {isLoading && <div className="text-sm text-brand-ash">Loading...</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-brand-navy">Type pattern</th>
              <th className="px-4 py-2 text-left font-semibold text-brand-navy">In-app</th>
              <th className="px-4 py-2 text-left font-semibold text-brand-navy">Email</th>
              <th className="px-4 py-2 text-left font-semibold text-brand-navy">Digest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((pref, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2">
                  <input
                    className="input input-bordered input-sm w-full"
                    value={pref.typePattern}
                    onChange={(e) => updateRow(idx, (p) => ({ ...p, typePattern: e.target.value }))}
                    placeholder="e.g. application.*"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={pref.inAppEnabled}
                    onChange={(e) => updateRow(idx, (p) => ({ ...p, inAppEnabled: e.target.checked }))}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={pref.emailEnabled}
                    onChange={(e) => updateRow(idx, (p) => ({ ...p, emailEnabled: e.target.checked }))}
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    className="select select-bordered select-sm"
                    value={pref.digestMode || 'instant'}
                    onChange={(e) => updateRow(idx, (p) => ({ ...p, digestMode: e.target.value as NotificationPreference['digestMode'] }))}
                  >
                    <option value="instant">Instant</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={addRow}>
        Add preference
      </button>
    </div>
  );
};

export default NotificationPreferencesPage;




