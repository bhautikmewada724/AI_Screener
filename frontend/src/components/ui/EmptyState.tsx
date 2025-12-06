import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

const EmptyState = ({ title = 'Nothing here yet', message, action }: EmptyStateProps) => (
  <div className="empty-state">
    <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
    <p className="text-sm text-brand-ash">{message}</p>
    {action}
  </div>
);

export default EmptyState;
