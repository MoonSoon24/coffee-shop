export default function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="h-24 rounded-xl bg-slate-200" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}