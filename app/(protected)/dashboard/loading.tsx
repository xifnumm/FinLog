export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-8 w-40 bg-[--color-bg-elevated] rounded-lg mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-[--color-bg-elevated] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 bg-[--color-bg-elevated] rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-[--color-bg-elevated] rounded-xl" />
    </div>
  );
}
