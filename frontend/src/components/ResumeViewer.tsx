import { useMemo, useState } from 'react';
import clsx from 'clsx';

import type { ResumePayload } from '../types/api';

interface ResumeViewerProps {
  resume?: ResumePayload;
  matchScore?: number;
  highlightedSkills?: string[];
}

const CONTACT_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\+?\d[\d\s\-()]{7,}/g,
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\b(?:linkedin|github|portfolio)\b\s*[:\-]?\s*\S*/gi,
  /\b(?:phone|mobile|email|mail|address)\b\s*[:\-]?\s*\S*/gi
];

const SECTION_HEADER_EXACT =
  /^(education|experience|skills|projects|certifications|summary|profile|objective)$/i;

const SKILL_LABELS = new Set(
  ['languages', 'tools', 'libraries', 'operating systems', 'frontend', 'backend', 'databases', 'skills'].map((label) =>
    label.toLowerCase()
  )
);

const stripContact = (value?: string) => {
  if (!value) return '';
  let cleaned = value;
  CONTACT_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, ' ');
  });
  return cleaned.replace(/\s+/g, ' ').trim();
};

const looksLikeGarbageSummary = (value: string) => {
  const text = value.toLowerCase();

  const garbageSignals = [
    'linkedin',
    'github',
    'gmail',
    'yahoo',
    'hotmail',
    'phone',
    'mobile',
    'bachelor of technology',
    'cgpa',
    'rajkot',
    'gujarat',
    'darshan university',
    'education'
  ];

  const hits = garbageSignals.filter((token) => text.includes(token)).length;

  const hasNoSentence = !/[.!?]/.test(value);
  const tooManySlashes = (value.match(/[\/|]/g) || []).length >= 2;
  const tooManyDigits = (value.match(/\d/g) || []).length >= 8;

  return hits >= 2 || (hasNoSentence && tooManySlashes) || (hasNoSentence && tooManyDigits);
};

const cleanSummary = (value?: string) => {
  if (!value) return '';

  let cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s@.+,()\-/:]/g, ' ')
    .trim();

  if (!cleaned) return '';

  cleaned = cleaned.replace(
    /^(professional\s+summary|summary|profile|objective)\s*[:\-–—]?\s*/i,
    ''
  ).trim();

  cleaned = cleaned
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
    .replace(/\+?\d[\d\s\-()]{7,}/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/\b(?:linkedin|github|portfolio)\b\s*[:\-]?\s*\S*/gi, ' ')
    .replace(/\b(?:phone|mobile|email|mail|address)\b\s*[:\-]?\s*\S*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s*/, '').trim();

  if (!cleaned || SECTION_HEADER_EXACT.test(cleaned)) return '';

  if (looksLikeGarbageSummary(cleaned)) return '';

  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim();

  if (firstSentence && firstSentence.length >= 35) {
    cleaned = firstSentence;
  }

  if (cleaned.length > 220) {
    cleaned = `${cleaned.slice(0, 217).trim()}...`;
  }

  return cleaned.trim();
};

const normalizeSkills = (skills: Array<string | undefined> | string | undefined) => {
  const raw = Array.isArray(skills) ? skills : typeof skills === 'string' ? [skills] : [];
  const tokens: string[] = [];

  raw.forEach((entry) => {
    if (!entry) return;

    entry
      .split(/[,|•·;\n]+/g)
      .map((part) => stripContact(part).trim())
      .filter(Boolean)
      .forEach((part) => {
        const labelSplit = part.split(':');

        if (labelSplit.length > 1 && SKILL_LABELS.has(labelSplit[0].trim().toLowerCase())) {
          const remainder = labelSplit.slice(1).join(':').trim();
          if (remainder) tokens.push(remainder);
          return;
        }

        if (SKILL_LABELS.has(part.toLowerCase())) return;
        tokens.push(part);
      });
  });

  const seen = new Set();
  return tokens.filter((token) => {
    const key = token.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const truncateText = (value: string, max = 240) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}…`;
};

const DATE_RANGE_PATTERN =
  /((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*\d{4}|\d{1,2}[/-]\d{4}|\d{4})\s*[-–—to]+\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*\d{4}|\d{1,2}[/-]\d{4}|\d{4}|present|current)/i;

type TabId = 'summary' | 'skills' | 'experience' | 'education' | 'location' | 'warnings';

const baseTabs: Array<{ id: TabId; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'location', label: 'Location' },
  { id: 'warnings', label: 'Warnings' }
];

const ResumeViewer = ({ resume, matchScore, highlightedSkills = [] }: ResumeViewerProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  if (!resume) return null;

  const parsedData = useMemo(() => {
    const base = resume.parsedData ?? {};
    const corrected = resume.parsedDataCorrected;

    if (corrected && Object.keys(corrected).length > 0) {
      const merged = { ...base };
      Object.keys(corrected).forEach((key) => {
        merged[key as keyof typeof merged] = corrected[key as keyof typeof corrected];
      });
      return merged;
    }

    return base;
  }, [resume]);

  const skills = normalizeSkills(parsedData?.skills);
  const experiences = parsedData?.experience ?? [];
  const education = parsedData?.education ?? [];
  const location = stripContact(parsedData?.location);
  const totalYearsExperience = parsedData?.totalYearsExperience;
  const warnings = (parsedData?.warnings ?? []).map((warning) => stripContact(warning)).filter(Boolean);

  const highlightSet = useMemo(() => new Set(highlightedSkills.map((skill) => skill.toLowerCase())), [highlightedSkills]);

  const summary = cleanSummary(parsedData?.summary);
  const uploadedAt = resume.createdAt ? new Date(resume.createdAt).toLocaleString() : undefined;

  const buildFallbackSummary = () => {
    const parts: string[] = [];

    if (skills.length > 0) {
      parts.push(`Skilled in ${skills.slice(0, 6).join(', ')}.`);
    }

    if (typeof totalYearsExperience === 'number' && totalYearsExperience > 0) {
      parts.push(`Has ${totalYearsExperience} year${totalYearsExperience > 1 ? 's' : ''} of identified experience.`);
    } else if (experiences.length > 0) {
      parts.push(`Resume includes ${experiences.length} experience entr${experiences.length > 1 ? 'ies' : 'y'}.`);
    }

    if (education.length > 0) {
      const topEducation = education[0];
      const degree = stripContact(topEducation?.degree);
      const institution = stripContact(topEducation?.institution);

      if (degree && institution) {
        parts.push(`Education includes ${degree} from ${institution}.`);
      } else if (degree) {
        parts.push(`Education includes ${degree}.`);
      } else if (institution) {
        parts.push(`Education includes studies at ${institution}.`);
      }
    }

    if (location) {
      parts.push(`Based in ${location}.`);
    }

    return parts.join(' ');
  };

  const summaryText = summary || buildFallbackSummary();

  const formatDate = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const formatDateRange = (start?: string, end?: string) => {
    const startLabel = formatDate(start);
    const endLabel = formatDate(end);
    if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
    if (startLabel && !endLabel) return `${startLabel} – Present`;
    return startLabel || endLabel || '';
  };

  const tabs = useMemo(() => {
    return baseTabs
      .filter((tab) => (tab.id === 'warnings' ? warnings.length > 0 : true))
      .map((tab) => {
        if (tab.id === 'skills') return { ...tab, label: `Skills (${skills.length})` };
        if (tab.id === 'experience') return { ...tab, label: `Experience (${experiences.length})` };
        if (tab.id === 'education') return { ...tab, label: `Education (${education.length})` };
        if (tab.id === 'warnings') return { ...tab, label: `Warnings (${warnings.length})` };
        return tab;
      });
  }, [education.length, experiences.length, skills.length, warnings.length]);

  if (resume.status === 'failed') {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">
        {stripContact(parsedData?.error || '') || 'Resume parsing failed. Please try uploading a different file.'}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-brand-navy">Resume Insights</h3>
          {uploadedAt && <p className="text-xs text-brand-ash">Uploaded {uploadedAt}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {resume?.status === 'parsed' && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-brand-navy">
              Parsed
            </span>
          )}

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

      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3">
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
        </div>

        <div className="col-span-12 lg:col-span-9">
          <div className="min-h-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {activeTab === 'summary' && (
              <section className="space-y-4 text-brand-navy">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 text-sm font-medium text-brand-ash">Professional Summary</div>
                  <p className="text-[15px] leading-7 text-slate-700 break-words">
                    {summaryText || 'No summary available for this resume.'}
                  </p>
                </div>

                {typeof totalYearsExperience === 'number' && (
                  <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-brand-navy ring-1 ring-indigo-100">
                    <strong>Experience:</strong> {totalYearsExperience} year{totalYearsExperience !== 1 ? 's' : ''}
                  </div>
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
                            : 'bg-white text-brand-navy ring-1 ring-slate-200'
                        )}
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <small className="text-brand-ash">Skills not found in this resume.</small>
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
                      <div key={`${experience.company}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold">
                          {stripContact(experience.role) || 'Role'} — {stripContact(experience.company) || 'Company'}
                        </div>
                        {formatDateRange(experience.startDate, experience.endDate) && (
                          <div className="text-xs text-brand-ash">{formatDateRange(experience.startDate, experience.endDate)}</div>
                        )}
                        {experience.description &&
                          !DATE_RANGE_PATTERN.test(experience.description) &&
                          experience.description.length > 3 && (
                            <p className="mt-2 text-sm leading-6 text-brand-navy">
                              {truncateText(stripContact(experience.description))}
                            </p>
                          )}
                      </div>
                    ))
                  ) : (
                    <small className="text-brand-ash">Experience not found in this resume.</small>
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
                      <div key={`${record.institution}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold">
                          {(record.degree && stripContact(record.degree)) || 'Education'} — {stripContact(record.institution)}
                        </div>
                        {record.year && <div className="text-xs text-brand-ash">Class of {record.year}</div>}
                      </div>
                    ))
                  ) : (
                    <small className="text-brand-ash">Education not found in this resume.</small>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'location' && (
              <section className="space-y-2 text-brand-navy">
                <strong>Location</strong>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-brand-ash">{location || 'Location not found in this resume.'}</p>
                </div>
              </section>
            )}

            {activeTab === 'warnings' && warnings.length > 0 && (
              <section className="space-y-2 text-brand-navy">
                <strong>Warnings</strong>
                {warnings.length ? (
                  <ul className="space-y-2 text-sm text-brand-ash">
                    {warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-brand-ash">No warnings flagged for this resume.</p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeViewer;