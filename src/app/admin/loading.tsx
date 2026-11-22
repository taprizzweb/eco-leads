export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="skel h-9 w-48" />
      <div className="skel h-4 w-72 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="skel h-28" /><div className="skel h-28" /><div className="skel h-28" /></div>
      <div className="skel h-56" />
    </div>
  );
}
