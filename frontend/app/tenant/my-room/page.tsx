import {TenantRoom} from '@/features/workspace/tenant-room';
import {LIVE_MODE} from '@/services/live/api';
import {LiveTenantRoomHistory} from '@/features/live/live-workspace';
export default function Page({searchParams}:{searchParams:{phone?:string}}){return LIVE_MODE?<LiveTenantRoomHistory/>:<TenantRoom requestedPhone={searchParams.phone||''}/>}
