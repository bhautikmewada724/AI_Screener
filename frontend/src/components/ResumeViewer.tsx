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

  const skills = resume.parsedData?.skills ?? [];
  const experiences = resume.parsedData?.experience ?? [];
  const education = resume.parsedData?.education ?? [];
  const location = resume.parsedData?.location;
  const highlightSet = useMemo(() => new Set(highlightedSkills.map((skill) => skill.toLowerCase())), [highlightedSkills]);

  return (
    <div className="card bg-brand-navy text-white">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-xl font-semibold">Resume Insights</h3>
        {typeof matchScore === 'number' && <span className="text-3xl font-bold">{Math.round(matchScore * 100)}%</span>}
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl bg-white/10 p-2 lg:flex-col lg:bg-transparent">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={clsx(
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'bg-white text-brand-navy' : 'text-white/80 hover:bg-white/10'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {activeTab === 'summary' && (
            <section className="space-y-3">
              <p className="text-white/90">{resume.parsedData?.summary || 'No summary available yet.'}</p>
              {location && (
                <p className="text-sm text-slate-200">
                  <strong>Location:</strong> {location}
                </p>
              )}
            </section>
          )}

          {activeTab === 'skills' && (
            <section className="space-y-3">
              <strong>Skills</strong>
              <div className="flex flex-wrap gap-2">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <span
                      key={skill}
                      className={clsx(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        highlightSet.has(skill.toLowerCase())
                          ? 'bg-amber-300 text-brand-navy'
                          : 'bg-white/10 text-white'
                      )}
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <small className="text-white/70">Awaiting parsed skill data.</small>
                )}
              </div>
            </section>
          )}

          {activeTab === 'experience' && (
            <section className="space-y-3">
              <strong>Experience</strong>
              <div className="grid gap-3">
                {experiences.length > 0 ? (
                  experiences.map((experience, index) => (
                    <div key={`${experience.company}-${index}`} className="rounded-2xl bg-white/10 p-4">
                      <div className="font-semibold">{experience.role}</div>
                      <div className="text-sm text-white/80">{experience.company}</div>
                      <small className="text-white/60">
                        {[experience.startDate, experience.endDate].filter(Boolean).join(' – ')}
                      </small>
                      {experience.description && (
                        <p className="mt-2 text-sm text-white/80">{experience.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <small className="text-white/70">Experience history not parsed.</small>
                )}
              </div>
            </section>
          )}

          {activeTab === 'education' && (
            <section className="space-y-3">
              <strong>Education</strong>
              <div className="grid gap-3">
                {education.length > 0 ? (
                  education.map((record, index) => (
                    <div key={`${record.institution}-${index}`} className="rounded-2xl bg-white/10 p-4">
                      <div className="font-semibold">{record.degree || 'Program'}</div>
                      <div className="text-sm text-white/80">{record.institution}</div>
                      {record.year && <small className="text-white/60">Class of {record.year}</small>}
                    </div>
                  ))
                ) : (
                  <small className="text-white/70">Education history not provided.</small>
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
