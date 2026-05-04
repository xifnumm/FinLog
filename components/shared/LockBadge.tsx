import { Lock, Unlock } from 'lucide-react';

interface LockBadgeProps {
  locked: boolean;
  className?: string;
}

export default function LockBadge({ locked, className = '' }: LockBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        locked
          ? 'bg-[--color-warning]/10 text-[--color-warning]'
          : 'bg-[--color-success]/10 text-[--color-success]'
      } ${className}`}
    >
      {locked ? <Lock size={11} /> : <Unlock size={11} />}
      {locked ? 'Locked' : 'Open'}
    </span>
  );
}
