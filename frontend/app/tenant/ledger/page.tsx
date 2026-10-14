import {LIVE_MODE} from '@/services/live/api';
import {LiveWorkspace} from '@/features/live/live-workspace';
import MockPage from './mock-page';
export default function Page(){return LIVE_MODE?<LiveWorkspace view='tenant-ledger'/>:<MockPage/>}
