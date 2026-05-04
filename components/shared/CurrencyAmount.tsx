import { formatMVR, formatUSD } from '@/lib/currency';

interface CurrencyAmountProps {
  mvr: number;
  showUsd?: boolean;
  className?: string;
}

export default function CurrencyAmount({ mvr, showUsd, className = '' }: CurrencyAmountProps) {
  return (
    <span className={`font-mono tabular-nums text-[--color-mvr] ${className}`}>
      {formatMVR(mvr)}
      {showUsd && (
        <span className="text-[--color-text-muted] text-xs ml-1">{formatUSD(mvr)}</span>
      )}
    </span>
  );
}
