import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useTopbarContext } from '../../layouts/AppShell';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
  const topbar = useTopbarContext();
  const setContent = topbar?.setContent;
  const resetContent = topbar?.resetContent;

  useEffect(() => {
    if (!setContent || !resetContent) return undefined;
    setContent({ title, subtitle });
    return () => {
      resetContent();
    };
  }, [subtitle, title, setContent, resetContent]);

  return (
  <header className="page-header">
    <div className="flex flex-col gap-1">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);
};

export default PageHeader;

