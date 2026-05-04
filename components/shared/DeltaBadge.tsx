import { formatMVR } from '@/lib/currency';

interface DeltaBadgeProps {
  delta: number | null;
  className?: string;
}

export default function DeltaBadge({ delta, className = '' }: DeltaBadgeProps) {
  if (delta === null) return null;

  const positive = delta >= 0;
  return (
    <span
      className={`font-mono tabular-nums text-sm ${
        positive ? 'text-[--color-success]' : 'text-[--color-danger]'
      } ${className}`}
    >
      {positive ? '+' : '-'}
      {formatMVR(Math.abs(delta))}
    </span>
  );
}
