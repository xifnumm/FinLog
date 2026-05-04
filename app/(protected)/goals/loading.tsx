export default function Loading() {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="h-7 w-28 rounded-lg bg-[--color-bg-elevated] mb-6 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[--color-bg-elevated] animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
        ))}
      </div>
    </div>
  );
}
