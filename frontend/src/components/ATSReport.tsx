import type { ATSScanResponse, ATFinding, ATEvidenceGap, ATRewriteStep } from '../types/api';
import SectionCard from './ui/SectionCard';
import StatCard from './ui/StatCard';

type Props = {
  report: ATSScanResponse;
};

const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const badgeClass = (status: ATEvidenceGap['status']) => {
  if (status === 'missing') return 'bg-rose-100 text-rose-700';
  if (status === 'weak') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

const ATSReport = ({ report }: Props) => {
  const findings = [...(report.formatFindings || [])].sort(
    (a: ATFinding, b: ATFinding) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const rewritePlan = [...(report.rewritePlan || [])]
    .sort((a: ATRewriteStep, b: ATRewriteStep) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 3);

  const missingRequired = report.skills?.missingRequired || [];
  const missingPreferred = report.skills?.missingPreferred || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="ATS Readability" value={`${report.overall.atsReadabilityScore}%`} tone="info" />
        <StatCard title="Keyword Match" value={`${report.overall.keywordMatchScore}%`} tone="info" />
        <StatCard title="Evidence Strength" value={`${report.overall.evidenceScore}%`} tone="info" />
      </div>

      <SectionCard title="Missing Required Skills">
        {missingRequired.length === 0 ? (
          <p className="text-sm text-emerald-700">Looks well aligned with required skills.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {missingRequired.map((skill) => (
              <span key={skill} className="chip chip-warning">
                {skill}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Format Findings">
        {findings.length === 0 ? (
          <p className="text-sm text-brand-ash">No format issues detected.</p>
        ) : (
          <div className="space-y-3">
            {findings.map((f) => (
              <div key={`${f.code}-${f.message}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-brand-navy">{f.message}</div>
                    <div className="text-xs text-brand-ash">{f.whyItMatters}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      f.severity === 'critical'
                        ? 'bg-rose-100 text-rose-700'
                        : f.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {f.severity}
                  </span>
                </div>
                <div className="mt-2 text-sm text-brand-ash">Fix: {f.fix}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Evidence Gaps">
        {report.evidenceGaps.length === 0 ? (
          <p className="text-sm text-emerald-700">Experience bullets already cover required skills.</p>
        ) : (
          <div className="space-y-2">
            {report.evidenceGaps.map((gap) => (
              <div key={gap.requirement} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-brand-navy">{gap.requirement}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(gap.status)}`}>
                    {gap.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-brand-ash">Add in: {gap.whereToAdd}</div>
                <div className="mt-2 text-sm text-brand-ash">Suggestion: {gap.exampleFix}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Rewrite Plan">
        {rewritePlan.length === 0 ? (
          <p className="text-sm text-brand-ash">No critical rewrite steps at this time.</p>
        ) : (
          <ol className="space-y-2">
            {rewritePlan.map((step, idx) => (
              <li key={`${step.title}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-brand-navy">{step.title}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {step.priority}
                  </span>
                </div>
                <div className="mt-1 text-sm text-brand-ash">{step.action}</div>
                <div className="mt-1 text-xs text-brand-ash">{step.details}</div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <SectionCard title="Missing Preferred Skills">
        {missingPreferred.length === 0 ? (
          <p className="text-sm text-brand-ash">No preferred skill gaps.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {missingPreferred.map((skill) => (
              <span key={skill} className="chip chip-muted">
                {skill}
              </span>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default ATSReport;

