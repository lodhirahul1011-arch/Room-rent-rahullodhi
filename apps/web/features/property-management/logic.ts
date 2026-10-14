import type { Portfolio, Room } from './types';
const validCalendarDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
export const activeTenancyForRoom = (p: Portfolio, roomId: string) => p.tenancies.find(t => t.roomId === roomId && t.status === 'active' && !t.moveOut);
export const isOccupied = (p: Portfolio, roomId: string) => !!activeTenancyForRoom(p,roomId);
export function roomStats(p: Portfolio, propertyId?: string) {
  const rooms=p.rooms.filter(r => !propertyId || r.propertyId === propertyId);
  return {total:rooms.length, occupied:rooms.filter(r => isOccupied(p,r.id)).length, vacant:rooms.filter(r => r.status==='active' && !isOccupied(p,r.id)).length, maintenance:rooms.filter(r => r.status==='maintenance').length};
}
export function assignTenant(p: Portfolio, tenantId: string, roomId: string, moveIn: string): Portfolio {
  const room=p.rooms.find(r=>r.id===roomId); if(!room || room.status!=='active') throw new Error('Room is not available');
  if(!p.tenants.some(t=>t.id===tenantId)) throw new Error('Tenant not found');
  if(isOccupied(p,roomId)) throw new Error('Room already occupied');
  if(p.tenancies.some(t=>t.tenantId===tenantId&&t.status==='active')) throw new Error('Tenant already has an active tenancy');
  if(!validCalendarDate(moveIn)) throw new Error('A valid move-in date is required');
  return {...p,tenancies:[...p.tenancies,{id:crypto.randomUUID(),tenantId,roomId,moveIn,moveOut:null,status:'active'}]};
}
export function endTenancy(p: Portfolio, tenancyId: string, moveOut: string): Portfolio {
  const target=p.tenancies.find(t=>t.id===tenancyId&&t.status==='active'); if(!target) throw new Error('Active tenancy not found');
  if(!validCalendarDate(moveOut) || moveOut<target.moveIn) throw new Error('Move-out cannot precede move-in');
  return {...p,tenancies:p.tenancies.map(t=>t.id===tenancyId?{...t,status:'ended' as const,moveOut}:t)};
}
export function roomLabel(p: Portfolio, r: Room) {return `${p.properties.find(x=>x.id===r.propertyId)?.name || 'Property'} · ${r.number}`;}
