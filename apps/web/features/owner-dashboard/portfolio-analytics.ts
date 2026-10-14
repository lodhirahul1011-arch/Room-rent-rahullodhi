import type { Portfolio } from '@/features/property-management/types';
import type { PropertyRecord, PendingAction, OwnerActivity } from './types';

/** Derive operational KPIs only from the shared Phase 3–4 portfolio.
 * Payments have not been implemented, so collected/pending figures cannot be inferred. */
export function derivePortfolioAnalytics(p: Portfolio) {
  const active = p.tenancies.filter(t => t.status === 'active' && !t.moveOut && p.rooms.some(r => r.id === t.roomId && r.status === 'active'));
  const occupiedRoomIds = new Set(active.map(t => t.roomId));
  const properties: PropertyRecord[] = p.properties.map(property => {
    const rooms = p.rooms.filter(room => room.propertyId === property.id);
    const occupiedRooms = rooms.filter(room => occupiedRoomIds.has(room.id)).length;
    const expectedRentPaise = rooms.filter(room => occupiedRoomIds.has(room.id)).reduce((n,r) => n + r.rentPaise,0);
    return {id:property.id,name:property.name,location:property.location,rooms:rooms.length,occupiedRooms,expectedRent:expectedRentPaise/100,collectedRent:0};
  });
  const expectedRentPaise = active.reduce((sum,t) => sum + (p.rooms.find(r => r.id===t.roomId)?.rentPaise ?? 0), 0);
  return {
    properties,
    totalProperties:p.properties.length,
    totalRooms:p.rooms.length,
    occupiedRooms:occupiedRoomIds.size,
    vacantRooms:p.rooms.filter(r => r.status==='active' && !occupiedRoomIds.has(r.id)).length,
    maintenanceRooms:p.rooms.filter(r => r.status==='maintenance').length,
    activeTenants:new Set(active.map(t => t.tenantId)).size,
    expectedRent:expectedRentPaise/100,
    occupancyRate:p.rooms.length ? occupiedRoomIds.size/p.rooms.length*100 : 0,
    pendingEnrollments:(p.enrollments ?? []).filter(e => e.status==='pending').length,
    financeTracked:false as const,
  };
}

export function deriveOperationalActions(p: Portfolio): PendingAction[] {
  const pending = (p.enrollments ?? []).filter(e => e.status === 'pending');
  return pending.length ? [{id:'enrollment-review',title:'Tenant enrollment requests',detail:`${pending[0].applicantName} · ${pending.length} request(s) waiting`,count:pending.length,tone:'blue',href:'/owner/enrollments',status:'action'}] : [];
}
export function deriveEnrollmentActivities(p: Portfolio): OwnerActivity[] {
  return [...(p.enrollments ?? [])].sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt)).slice(0,5).map(e => ({
    id:e.id,title:e.status==='approved'?'Enrollment approved':e.status==='rejected'?'Enrollment rejected':'Enrollment submitted',
    detail:e.applicantName, timestamp:new Date(e.decisionAt ?? e.submittedAt).toLocaleDateString('en-IN'),tone:e.status==='approved'?'green':e.status==='rejected'?'slate':'blue',
  }));
}
