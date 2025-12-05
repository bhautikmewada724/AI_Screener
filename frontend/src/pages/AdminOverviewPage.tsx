import { useQuery } from '@tanstack/react-query';

import { fetchSystemOverview } from '../api/admin';
import { useAuth } from '../hooks/useAuth';

const StatCard = ({ label, value, description }: { label: string; value: number | string; description?: string }) => (
  <div className="card" style={{ textAlign: 'center' }}>
    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{label}</p>
    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
    {description && <small style={{ color: '#94a3b8' }}>{description}</small>}
  </div>
);

const DistributionList = ({ title, data }: { title: string; data: Record<string, number> }) => (
  <div className="card">
    <h3 style={{ marginTop: 0 }}>{title}</h3>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem' }}>
      {Object.entries(data).map(([key, value]) => (
        <li key={key} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
          <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
          <span>{value}</span>
        </li>
      ))}
    </ul>
  </div>
);

const AdminOverviewPage = () => {
  const { token } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchSystemOverview(token),
    enabled: !!token,
    staleTime: 60_000
  });

  const overview = overviewQuery.data;

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.5rem' }}>System Overview</h1>
        <p style={{ color: '#475569' }}>High-level metrics across users, jobs, and applications.</p>
      </header>

      {overviewQuery.isLoading && <p>Loading metrics…</p>}
      {overviewQuery.isError && (
        <p style={{ color: '#b91c1c' }}>Failed to load overview: {(overviewQuery.error as Error).message}</p>
      )}

      {overview && (
        <>
          <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <StatCard label="Total Users" value={overview.users.total} />
            <StatCard label="Total Jobs" value={overview.jobs.total} />
            <StatCard label="Total Applications" value={overview.applications.total} />
          </section>

          <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <DistributionList title="Users by Role" data={overview.users.byRole} />
            <DistributionList title="Users by Status" data={overview.users.byStatus} />
            <DistributionList title="Jobs by Status" data={overview.jobs.byStatus} />
            <DistributionList title="Applications by Status" data={overview.applications.byStatus} />
          </section>
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;


