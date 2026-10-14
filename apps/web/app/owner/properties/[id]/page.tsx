import {LIVE_MODE} from '@/services/live/api';
import {LiveWorkspace} from '@/features/live/live-workspace';
import MockPage from './mock-page';
export default function Page({params}:{params:{id:string}}){return LIVE_MODE?<LiveWorkspace view='property-detail' propertyId={params.id}/>:<MockPage params={params}/>;}
