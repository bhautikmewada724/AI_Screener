import { useMemo, useState } from 'react';
import clsx from 'clsx';

import type { ResumePayload } from '../types/api';

interface ResumeViewerProps {
  resume?: ResumePayload;
  matchScore?: number;
  highlightedSkills?: string[];
}

const tabs = [
  { id: 'summary', label: 'Summary' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' }
] as const;

const ResumeViewer = ({ resume, matchScore, highlightedSkills = [] }: ResumeViewerProps) => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('summary');

  if (!resume) return null;

  const parsedData = useMemo(() => {
    const base = resume.parsedData ?? {};
    const corrected = resume.parsedDataCorrected;
    if (corrected && Object.keys(corrected).length > 0) {
      const merged = { ...base };
      Object.keys(corrected).forEach((key) => {
        // allow overriding with empty arrays/strings/numbers
        merged[key as keyof typeof merged] = corrected[key as keyof typeof corrected];
      });
      return merged;
    }
    return base;
  }, [resume]);

  const skills = parsedData?.skills ?? [];
  const experiences = parsedData?.experience ?? [];
  const education = parsedData?.education ?? [];
  const location = parsedData?.location;
  const totalYearsExperience = parsedData?.totalYearsExperience;
  const highlightSet = useMemo(() => new Set(highlightedSkills.map((skill) => skill.toLowerCase())), [highlightedSkills]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-lg font-semibold text-brand-navy">Resume Insights</h3>
        <div className="flex flex-wrap items-center gap-3">
          {resume?.isCorrected && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Candidate verified
            </span>
          )}
          {typeof matchScore === 'number' && (
            <span className="text-3xl font-bold text-brand-navy">{Math.round(matchScore * 100)}%</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 lg:flex-col">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={clsx(
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-card-sm' : 'text-brand-navy hover:bg-indigo-50'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {activeTab === 'summary' && (
            <section className="space-y-3 text-brand-navy">
              <p className="text-sm text-brand-ash">{parsedData?.summary || 'No summary available yet.'}</p>
              {location && (
                <p className="text-sm text-brand-navy">
                  <strong>Location:</strong> {location}
                </p>
              )}
              {typeof totalYearsExperience === 'number' && (
                <p className="text-sm text-brand-navy">
                  <strong>Experience:</strong> {totalYearsExperience} years
                </p>
              )}
            </section>
          )}

          {activeTab === 'skills' && (
            <section className="space-y-3 text-brand-navy">
              <strong>Skills</strong>
              <div className="flex flex-wrap gap-2">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <span
                      key={skill}
                      className={clsx(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        highlightSet.has(skill.toLowerCase())
                          ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200'
                          : 'bg-slate-100 text-brand-navy'
                      )}
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <small className="text-brand-ash">Awaiting parsed skill data.</small>
                )}
              </div>
            </section>
          )}

          {activeTab === 'experience' && (
            <section className="space-y-3 text-brand-navy">
              <strong>Experience</strong>
              <div className="grid gap-3">
                {experiences.length > 0 ? (
                  experiences.map((experience, index) => (
                    <div key={`${experience.company}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="font-semibold">{experience.role}</div>
                      <div className="text-sm text-brand-ash">{experience.company}</div>
                      <small className="text-xs text-brand-ash">
                        {[experience.startDate, experience.endDate].filter(Boolean).join(' – ')}
                      </small>
                      {experience.description && (
                        <p className="mt-2 text-sm text-brand-navy">{experience.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <small className="text-brand-ash">Experience history not parsed.</small>
                )}
              </div>
            </section>
          )}

          {activeTab === 'education' && (
            <section className="space-y-3 text-brand-navy">
              <strong>Education</strong>
              <div className="grid gap-3">
                {education.length > 0 ? (
                  education.map((record, index) => (
                    <div key={`${record.institution}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="font-semibold">{record.degree || 'Program'}</div>
                      <div className="text-sm text-brand-ash">{record.institution}</div>
                      {record.year && <small className="text-xs text-brand-ash">Class of {record.year}</small>}
                    </div>
                  ))
                ) : (
                  <small className="text-brand-ash">Education history not provided.</small>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeViewer;
