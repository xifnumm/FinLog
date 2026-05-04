export default function LedgerLoading() {
  return (
    <div className="animate-pulse">
      <div className="sticky top-0 border-b border-[--color-bg-border] px-6 py-4">
        <div className="h-7 w-48 bg-[--color-bg-elevated] rounded-lg mx-auto" />
      </div>
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-[--color-bg-elevated] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
