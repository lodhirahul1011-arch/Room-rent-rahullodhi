import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { TenancyPage } from '@/features/enrollment/tenancy-page';
export default function Page(){return <RoomRentShell role="owner"><PortfolioProvider><TenancyPage/></PortfolioProvider></RoomRentShell>}
