import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

const SectionCard = ({ title, description, actions, children, className = '' }: SectionCardProps) => (
  <section className={`section-card ${className}`}>
    {(title || description || actions) && (
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {title && <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>}
          {description && <p className="text-sm text-brand-ash">{description}</p>}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    )}
    <div className="space-y-4">{children}</div>
  </section>
);

export default SectionCard;

