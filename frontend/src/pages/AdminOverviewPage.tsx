import { useQuery } from '@tanstack/react-query';

import { fetchSystemOverview } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import InfoListCard from '../components/ui/InfoListCard';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import SectionCard from '../components/ui/SectionCard';

const AdminOverviewPage = () => {
  const { token } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchSystemOverview(token),
    enabled: !!token,
    staleTime: 60_000
  });

  const overview = overviewQuery.data;
  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : 'No events yet';

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

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Users"
              description="Role distribution, account health, and recent signups."
              actions={
                overview.users.createdLast7Days !== undefined ? (
                  <span className="text-xs text-brand-ash">
                    New last 7 days: {overview.users.createdLast7Days}
                  </span>
                ) : null
              }
            >
              <InfoListCard title="By Role" data={overview.users.byRole} />
              <InfoListCard title="By Status" data={overview.users.byStatus} />
            </SectionCard>

            <SectionCard
              title="Jobs"
              description="Pipeline of open and closed roles."
              actions={
                overview.jobs.createdLast30Days !== undefined ? (
                  <span className="text-xs text-brand-ash">
                    Created last 30 days: {overview.jobs.createdLast30Days}
                  </span>
                ) : null
              }
            >
              <InfoListCard title="By Status" data={overview.jobs.byStatus} />
            </SectionCard>

            <SectionCard
              title="Applications"
              description="Candidate flow across review stages."
              actions={
                overview.applications.createdLast30Days !== undefined ? (
                  <span className="text-xs text-brand-ash">
                    Submitted last 30 days: {overview.applications.createdLast30Days}
                  </span>
                ) : null
              }
            >
              <InfoListCard title="By Status" data={overview.applications.byStatus} />
            </SectionCard>

            <SectionCard title="System Health" description="Recent audit signal and platform activity.">
              <InfoListCard
                title="Audit"
                data={{ 'Last audit event': formatDateTime(overview.health?.lastAuditEventAt) as unknown as number }}
              />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;


