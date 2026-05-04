export default function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#ededf8' }}>{title}</h1>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: '#8080a8' }}>{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}
