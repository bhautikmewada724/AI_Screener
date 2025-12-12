interface NotAuthorizedProps {
  message?: string;
  onBack?: () => void;
}

const NotAuthorized = ({ message, onBack }: NotAuthorizedProps) => {
  return (
    <div className="page-shell flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="text-3xl font-semibold text-brand-navy">Not authorized</div>
      <p className="max-w-md text-sm text-brand-ash">
        {message || 'You do not have permission to view this page.'}
      </p>
      {onBack && (
        <button className="btn btn-secondary" onClick={onBack}>
          Go back
        </button>
      )}
    </div>
  );
};

export default NotAuthorized;

