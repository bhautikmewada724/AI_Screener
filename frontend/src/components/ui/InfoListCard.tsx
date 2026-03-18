interface InfoListCardProps {
  title: string;
  data: Record<string, number>;
}

const InfoListCard = ({ title, data }: InfoListCardProps) => (
  <section className="section-card">
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
    </div>
    <ul className="divide-y divide-slate-100 text-sm">
      {Object.entries(data).map(([label, value]) => (
        <li key={label} className="flex items-center justify-between py-2">
          <span className="font-medium capitalize text-brand-navy">{label.replace('_', ' ')}</span>
          <span className="text-brand-ash">{value}</span>
        </li>
      ))}
    </ul>
  </section>
);

export default InfoListCard;

