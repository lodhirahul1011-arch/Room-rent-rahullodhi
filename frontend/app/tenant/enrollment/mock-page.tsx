import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { EnrollmentPage } from '@/features/enrollment/enrollment-page';
export default function Page(){return <RoomRentShell role="tenant"><PortfolioProvider><EnrollmentPage/></PortfolioProvider></RoomRentShell>}
