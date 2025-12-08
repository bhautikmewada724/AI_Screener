import type { ResumePayload } from '../types/api';

interface ResumeViewerProps {
  resume?: ResumePayload;
  matchScore?: number;
}

const ResumeViewer = ({ resume, matchScore }: ResumeViewerProps) => {
  if (!resume) return null;

  const skills = resume.parsedData?.skills ?? [];
  const experiences = resume.parsedData?.experience ?? [];
  const education = resume.parsedData?.education ?? [];
  const location = resume.parsedData?.location;

  return (
    <div className="card" style={{ background: '#0f172a', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>Resume Insights</h3>
        {typeof matchScore === 'number' && (
          <span style={{ fontSize: '2rem', fontWeight: 700 }}>{Math.round(matchScore * 100)}%</span>
        )}
      </div>
      <p style={{ color: '#e2e8f0' }}>{resume.parsedData?.summary || 'No summary available yet.'}</p>
      {location && (
        <p style={{ marginTop: '0.25rem', color: '#cbd5f5' }}>
          <strong>Location:</strong> {location}
        </p>
      )}

      <section>
        <strong>Skills</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
          {skills.length > 0 ? (
            skills.map((skill) => (
              <span key={skill} style={{ padding: '0.25rem 0.65rem', background: '#1e293b', borderRadius: '999px' }}>
                {skill}
              </span>
            ))
          ) : (
            <small style={{ color: '#cbd5f5' }}>Awaiting parsed skill data.</small>
          )}
        </div>
      </section>

      <section style={{ marginTop: '1rem' }}>
        <strong>Experience</strong>
        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
          {experiences.length > 0 ? (
            experiences.map((experience, index) => (
              <div key={`${experience.company}-${index}`} style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.75rem' }}>
                <div style={{ fontWeight: 600 }}>{experience.role}</div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5f5' }}>{experience.company}</div>
                <small style={{ color: '#94a3b8' }}>
                  {[experience.startDate, experience.endDate].filter(Boolean).join(' – ')}
                </small>
              </div>
            ))
          ) : (
            <small style={{ color: '#cbd5f5' }}>Experience history not parsed.</small>
          )}
        </div>
      </section>

      <section style={{ marginTop: '1rem' }}>
        <strong>Education</strong>
        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
          {education.length > 0 ? (
            education.map((record, index) => (
              <div key={`${record.institution}-${index}`} style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.75rem' }}>
                <div style={{ fontWeight: 600 }}>{record.degree || 'Program'}</div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5f5' }}>{record.institution}</div>
                {record.year && <small style={{ color: '#94a3b8' }}>Class of {record.year}</small>}
              </div>
            ))
          ) : (
            <small style={{ color: '#cbd5f5' }}>Education history not provided.</small>
          )}
        </div>
      </section>
    </div>
  );
};

export default ResumeViewer;


