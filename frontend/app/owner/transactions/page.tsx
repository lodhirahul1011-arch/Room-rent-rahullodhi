import {LIVE_MODE} from '@/services/live/api';
import {TransactionsPage} from '@/features/transactions/transactions-page';
import {LiveUnsupported} from '@/features/live/live-workspace';
import {RoomRentShell} from '@/components/roomrent-shell';
export default function Page(){return <RoomRentShell role="owner">{LIVE_MODE?<TransactionsPage role="owner"/>:<LiveUnsupported title="Transactions"/>}</RoomRentShell>}
