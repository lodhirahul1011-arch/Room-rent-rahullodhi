export default function OwnerDashboardLoading() {
  return <main className="min-h-screen bg-[#f7f9f8] p-6 sm:p-10"><div className="mx-auto max-w-[1180px] animate-pulse space-y-6"><div className="h-8 w-64 rounded-lg bg-[#dfeae6]" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-white" />)}</div><div className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]"><div className="h-[380px] rounded-2xl bg-white" /><div className="h-[380px] rounded-2xl bg-white" /></div></div></main>;
}
