interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <div className="error-state">
    <p>{message}</p>
    {onRetry ? (
      <button className="btn btn-secondary" onClick={onRetry}>
        Retry
      </button>
    ) : null}
  </div>
);

export default ErrorState;
