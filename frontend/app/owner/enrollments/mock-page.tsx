import { RoomRentShell } from '@/components/roomrent-shell';
import { PortfolioProvider } from '@/features/property-management/store';
import { ApprovalPage } from '@/features/enrollment/approval-page';
export default function Page(){return <RoomRentShell role="owner"><PortfolioProvider><ApprovalPage/></PortfolioProvider></RoomRentShell>}
