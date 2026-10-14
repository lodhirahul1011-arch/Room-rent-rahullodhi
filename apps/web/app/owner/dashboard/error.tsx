'use client';

export default function OwnerDashboardError({ reset }: { reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f9f8] p-6"><section className="max-w-md rounded-2xl border border-[#e1ebe7] bg-white p-8 text-center shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bd6256]">Dashboard unavailable</p><h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">We couldn&apos;t load your overview</h1><p className="mt-3 text-sm leading-6 text-[#71817a]">Your records are safe. Try loading the owner dashboard again.</p><button onClick={reset} className="mt-6 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white">Try again</button></section></main>;
}
