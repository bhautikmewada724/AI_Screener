import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { NavLink } from 'react-router-dom';

export interface ShellNavItem {
  to: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  navItems: ShellNavItem[];
  children: ReactNode;
  onLogout: () => void;
}

type TopbarContent = { title?: string; subtitle?: string };

interface TopbarContextValue {
  content: TopbarContent;
  setContent: (content: TopbarContent) => void;
  resetContent: () => void;
}

export const TopbarContext = createContext<TopbarContextValue | null>(null);

export const useTopbarContext = () => useContext(TopbarContext);

export const AppShell = ({ title, subtitle, navItems, children, onLogout }: AppShellProps) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const defaultTopbarRef = useRef<TopbarContent>({ title, subtitle });
  const [topbarContent, setTopbarContent] = useState<TopbarContent>(defaultTopbarRef.current);

  const toggleMobileNav = () => setMobileNavOpen((prev) => !prev);
  const closeMobileNav = () => setMobileNavOpen(false);

  useEffect(() => {
    const next = { title, subtitle };
    defaultTopbarRef.current = next;
    setTopbarContent(next);
  }, [title, subtitle]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const isScrollingDown = currentY > lastScrollY.current;
      const shouldHide = isScrollingDown && currentY > 80 && !mobileNavOpen;

      setHeaderHidden(shouldHide);
      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      setHeaderHidden(false);
    }
  }, [mobileNavOpen]);

  const setContent = useCallback((content: TopbarContent) => {
    setTopbarContent(content);
  }, []);

  const resetContent = useCallback(() => {
    setTopbarContent(defaultTopbarRef.current);
  }, []);

  const contextValue = useMemo<TopbarContextValue>(
    () => ({
      content: topbarContent,
      setContent,
      resetContent
    }),
    [topbarContent, setContent, resetContent]
  );

  return (
    <TopbarContext.Provider value={contextValue}>
      <div className="min-h-screen bg-brand-surface lg:flex lg:h-screen lg:overflow-hidden">
      <div
          className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-brand-navy text-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-full lg:overflow-y-auto lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col gap-6 px-6 py-8">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-white/60">AI Screener</p>
            <h2 className="text-2xl font-semibold">{title}</h2>
            {subtitle && <small className="text-white/70">{subtitle}</small>}
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMobileNav}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-colors ${
                    item.disabled ? 'pointer-events-none opacity-50' : ''
                  } ${isActive ? 'bg-white text-brand-navy' : 'text-white hover:bg-white/10'}`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="btn btn-secondary w-full justify-center" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {mobileNavOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={closeMobileNav} />}

        <div className="flex min-h-screen flex-1 flex-col lg:h-screen lg:overflow-hidden">
          <header
            className={`sticky top-0 z-20 border-b border-slate-100/70 bg-brand-surface/95 shadow-sm backdrop-blur transition-transform duration-200 ${
              headerHidden ? '-translate-y-full' : 'translate-y-0'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-brand-navy lg:hidden"
              onClick={toggleMobileNav}
              aria-label="Toggle navigation"
            >
              <span className="sr-only">Toggle navigation</span>
              <div className="space-y-1">
                <span className="block h-0.5 w-6 bg-current" />
                <span className="block h-0.5 w-6 bg-current" />
                <span className="block h-0.5 w-6 bg-current" />
              </div>
            </button>
              <div className="flex flex-1 items-center justify-between gap-2">
                <div className="flex flex-1 flex-col items-end overflow-hidden text-right lg:hidden">
                  {topbarContent.title && (
                    <p className="truncate text-sm font-semibold text-brand-navy">{topbarContent.title}</p>
                  )}
                  {topbarContent.subtitle && (
                    <small className="truncate text-xs text-brand-ash">{topbarContent.subtitle}</small>
                  )}
                </div>
                <div className="flex flex-1 items-center justify-end gap-2" />
            </div>
          </div>
        </header>
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
    </TopbarContext.Provider>
  );
};


