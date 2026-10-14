import {LIVE_MODE} from '@/services/live/api';
import {LiveUnsupported} from '@/features/live/live-workspace';
import {RoomRentShell} from '@/components/roomrent-shell';
import MockPage from './mock-page';
export default function Page({params}:{params:{slug:string[]}}){return LIVE_MODE?<RoomRentShell role='tenant'><LiveUnsupported title='This module is not connected to the backend'/></RoomRentShell>:<MockPage params={params}/>;}
