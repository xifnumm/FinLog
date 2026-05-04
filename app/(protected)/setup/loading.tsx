export default function SetupLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-32 bg-[--color-bg-elevated] rounded-lg mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-[--color-bg-elevated] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
