import { describe,it,expect } from 'vitest';
import { createSeedPortfolio } from '@/features/property-management/seed';
import { activeTenancyForRoom,assignTenant,endTenancy,roomStats } from '@/features/property-management/logic';
describe('Phase 3 room occupancy',()=>{
 it('seeds 4 buildings, 62 rooms and 55 active tenants',()=>{const p=createSeedPortfolio();expect(p.properties).toHaveLength(4);expect(roomStats(p).total).toBe(62);expect(roomStats(p).occupied).toBe(55);expect(roomStats(p).vacant).toBe(7)});
 it('rejects double-booking and missing tenants',()=>{const p=createSeedPortfolio();expect(()=>assignTenant(p,p.tenants[0].id,p.rooms[0].id,'2026-10-14')).toThrow();expect(()=>assignTenant(p,'invalid',p.rooms[23].id,'2026-10-14')).toThrow()});
 it('preserves tenancy history on move-out',()=>{const p=createSeedPortfolio();const t=p.tenancies[0];const moved=endTenancy(p,t.id,'2026-10-14');expect(activeTenancyForRoom(moved,t.roomId)).toBeUndefined();expect(moved.tenancies.find(x=>x.id===t.id)?.moveOut).toBe('2026-10-14');expect(activeTenancyForRoom(p,t.roomId)).toBeDefined()});
 it('allows an unassigned tenant to move into a vacant room',()=>{const p=createSeedPortfolio();const tenant={...p.tenants[0],id:'new-tenant'};const q=assignTenant({...p,tenants:[...p.tenants,tenant]},tenant.id,p.rooms[23].id,'2026-10-14');expect(roomStats(q).occupied).toBe(56)});
 it('refuses a move-out before move-in',()=>{const p=createSeedPortfolio();expect(()=>endTenancy(p,p.tenancies[0].id,'2026-01-01')).toThrow()});
});
