import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { PropertyDetail } from '@/features/property-management/property-detail';
export default function Page({params}:{params:{id:string}}){return <RoomRentShell role="owner"><PortfolioProvider><PropertyDetail id={params.id}/></PortfolioProvider></RoomRentShell>}
