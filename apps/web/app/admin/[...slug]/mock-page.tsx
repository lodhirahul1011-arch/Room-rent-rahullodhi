import { RoomRentShell } from '@/components/roomrent-shell';

export default function AdminSectionPage({ params }: { params: { slug: string[] } }) {
  const title = params.slug.join(' / ').replace(/-/g, ' ');
  return <RoomRentShell role="admin"><Placeholder title={title} role="admin" /></RoomRentShell>;
}

function Placeholder({ title, role }: { title: string; role: 'admin' }) {
  return <section className="animate-fade-up rounded-2xl border border-[#e1ebe7] bg-white p-8 shadow-[0_8px_30px_rgba(29,66,54,0.04)] dark:border-[#2b3c37] dark:bg-[#17211f]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0f766e]">{role} workspace</p><h1 className="mt-3 text-3xl font-semibold capitalize tracking-[-0.04em]">{title}</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#71817a]">This workspace is ready for the next RoomRent phase. Navigation, layout, and role context are already connected.</p><div className="mt-8 rounded-xl border border-dashed border-[#c9ddd7] bg-[#f5faf8] p-5 text-sm text-[#61716b]">Your operational data will appear here once the service layer is connected.</div></section>;
}
