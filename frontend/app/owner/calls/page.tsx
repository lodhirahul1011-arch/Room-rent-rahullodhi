import {LIVE_MODE} from '@/services/live/api';
import {LiveUnsupported} from '@/features/live/live-workspace';
import {RoomRentShell} from '@/components/roomrent-shell';
import MockPage from './mock-page';
export default function Page(){return LIVE_MODE?<RoomRentShell role='owner'><LiveUnsupported title='Calls — backend not yet available'/></RoomRentShell>:<MockPage/>}
