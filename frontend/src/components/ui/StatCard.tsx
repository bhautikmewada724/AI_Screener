interface StatCardProps {
  label: string;
  value: number | string;
  description?: string;
}

const StatCard = ({ label, value, description }: StatCardProps) => (
  <div className="card text-center">
    <p className="text-sm font-medium text-brand-ash">{label}</p>
    <div className="text-3xl font-semibold text-brand-navy">{value}</div>
    {description && <p className="text-xs text-brand-ash/80">{description}</p>}
  </div>
);

export default StatCard;

