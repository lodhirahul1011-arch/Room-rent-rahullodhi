import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { TenantsPage } from '@/features/property-management/tenants';
export default function Page(){return <RoomRentShell role="owner"><PortfolioProvider><TenantsPage/></PortfolioProvider></RoomRentShell>}
