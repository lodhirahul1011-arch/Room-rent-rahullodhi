import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { PropertiesPage } from '@/features/property-management/properties';
export default function Page(){return <RoomRentShell role="owner"><PortfolioProvider><PropertiesPage/></PortfolioProvider></RoomRentShell>}
