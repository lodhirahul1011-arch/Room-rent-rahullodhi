import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { EnrollmentStatusPage } from '@/features/enrollment/enrollment-page';
export default function Page(){return <RoomRentShell role="tenant"><PortfolioProvider><EnrollmentStatusPage/></PortfolioProvider></RoomRentShell>}
