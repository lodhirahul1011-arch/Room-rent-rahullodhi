import {describe,it,expect} from 'vitest';
import {createSeedPortfolio} from '@/features/property-management/seed';
import {derivePortfolioAnalytics,deriveOperationalActions,deriveEnrollmentActivities} from '@/features/owner-dashboard/portfolio-analytics';
import {endTenancy} from '@/features/property-management/logic';
import type {Portfolio} from '@/features/property-management/types';

describe('Phase 4.1 dashboard integration',()=>{
  it('uses the same source for rooms, tenants and expected room rent',()=>{
    const p=createSeedPortfolio();const a=derivePortfolioAnalytics(p);
    expect(a.totalRooms).toBe(p.rooms.length);
    expect(a.occupiedRooms).toBe(p.tenancies.filter(t=>t.status==='active').length);
    expect(a.activeTenants).toBe(new Set(p.tenancies.map(t=>t.tenantId)).size);
    expect(a.expectedRent).toBe(p.tenancies.reduce((sum,t)=>sum+(p.rooms.find(r=>r.id===t.roomId)?.rentPaise??0),0)/100);
    expect(a.properties.every(x=>p.properties.some(y=>y.id===x.id))).toBe(true);
    expect(a.financeTracked).toBe(false);
  });
  it('immediately reflects a move-out in occupancy and expected rent',()=>{
    const p=createSeedPortfolio();const before=derivePortfolioAnalytics(p);
    const updated=endTenancy(p,p.tenancies[0].id,'2026-10-14');const after=derivePortfolioAnalytics(updated);
    expect(after.occupiedRooms).toBe(before.occupiedRooms-1);
    expect(after.vacantRooms).toBe(before.vacantRooms+1);
    expect(after.expectedRent).toBeLessThan(before.expectedRent);
  });
  it('handles an empty portfolio with no divide-by-zero',()=>{
    const empty:Portfolio={properties:[],floors:[],rooms:[],tenants:[],tenancies:[],enrollments:[]};
    const a=derivePortfolioAnalytics(empty);
    expect(a.occupancyRate).toBe(0);expect(a.expectedRent).toBe(0);
    expect(deriveOperationalActions(empty)).toEqual([]);
    expect(deriveEnrollmentActivities(empty)).toEqual([]);
  });
  it('counts pending only, never rejected or approved enrollments',()=>{
    const p=createSeedPortfolio();
    p.enrollments=[...(['pending','approved','rejected'] as const).map((status,i)=>({id:String(i),applicantName:`Applicant ${i}`,phone:'1234567890',email:'a@b.com',emergencyContact:'',address:'X',propertyId:p.properties[0].id,roomId:p.rooms[0].id,moveIn:'2026-10-10',submittedAt:'2026-10-09',status,documents:[],rejectionReason:'',decisionAt:null,approvedTenantId:null,approvedTenancyId:null}))];
    expect(derivePortfolioAnalytics(p).pendingEnrollments).toBe(1);
    expect(deriveOperationalActions(p)[0].count).toBe(1);
  });
});
