import {LIVE_MODE} from '@/services/live/api';
import {TransactionsPage} from '@/features/transactions/transactions-page';
import {LiveUnsupported} from '@/features/live/live-workspace';
export default function Page(){return LIVE_MODE?<TransactionsPage role="owner"/>:<LiveUnsupported title="Transactions"/>}
