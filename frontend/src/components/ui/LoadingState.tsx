interface LoadingStateProps {
  message?: string;
}

const LoadingState = ({ message = 'Loading…' }: LoadingStateProps) => (
  <div className="loading-state">
    <svg className="h-10 w-10 animate-spin text-brand-accent" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
    </svg>
    <p>{message}</p>
  </div>
);

export default LoadingState;
