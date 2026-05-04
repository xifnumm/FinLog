export default function Loading() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="h-7 w-24 rounded-lg bg-[--color-bg-elevated] mb-6 animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[--color-bg-elevated] animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
