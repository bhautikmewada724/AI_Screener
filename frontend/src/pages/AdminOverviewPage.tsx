import { useQuery } from '@tanstack/react-query';

import { fetchSystemOverview } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import InfoListCard from '../components/ui/InfoListCard';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

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
    <div className="page-shell">
      <PageHeader title="System Overview" subtitle="High-level metrics across users, jobs, and applications." />

      {overviewQuery.isLoading && <LoadingState message="Loading metrics…" />}
      {overviewQuery.isError && (
        <ErrorState message={`Failed to load overview: ${(overviewQuery.error as Error).message}`} onRetry={() => overviewQuery.refetch()} />
      )}

      {overview && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Users" value={overview.users.total} />
            <StatCard label="Total Jobs" value={overview.jobs.total} />
            <StatCard label="Total Applications" value={overview.applications.total} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <InfoListCard title="Users by Role" data={overview.users.byRole} />
            <InfoListCard title="Users by Status" data={overview.users.byStatus} />
            <InfoListCard title="Jobs by Status" data={overview.jobs.byStatus} />
            <InfoListCard title="Applications by Status" data={overview.applications.byStatus} />
          </section>
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;


