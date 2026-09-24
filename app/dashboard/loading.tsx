export default function CargandoDashboard() {
  return (
    <main className="min-h-dvh bg-[#F4F6F0] px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DCE4DB]">
          <div className="h-9 w-32 rounded-2xl bg-white border border-[#DCE4DB]" />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-xl bg-white border border-[#DCE4DB]" />
            <div className="h-9 w-24 rounded-xl bg-white border border-[#DCE4DB]" />
          </div>
        </div>

        {/* Month bar skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-[#DDECDD]" />
            <div className="h-8 w-48 rounded-xl bg-white border border-[#DCE4DB]" />
          </div>
          <div className="h-11 w-64 rounded-2xl bg-white border border-[#DCE4DB]" />
        </div>

        {/* Hero cards skeleton */}
        <div className="h-20 w-full rounded-2xl bg-white border border-[#DCE4DB]" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 rounded-3xl bg-white border border-[#DCE4DB]" />
          <div className="h-72 rounded-3xl bg-white border border-[#DCE4DB]" />
        </div>

        <div className="h-64 rounded-3xl bg-white border border-[#DCE4DB]" />
      </div>
    </main>
  );
}
