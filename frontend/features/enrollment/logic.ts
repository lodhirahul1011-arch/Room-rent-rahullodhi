import { assignTenant, isOccupied } from '@/features/property-management/logic';
import type { Enrollment, EnrollmentDocument, Portfolio } from '@/features/property-management/types';
export type EnrollmentDraft = Pick<Enrollment,'applicantName'|'phone'|'email'|'emergencyContact'|'address'|'propertyId'|'roomId'|'moveIn'|'documents'>;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export function validateDraft(p: Portfolio, d: EnrollmentDraft) {
  if (d.applicantName.trim().length < 2) throw new Error('Enter full name');
  if (!/^[0-9]{10}$/.test(d.phone)) throw new Error('Enter a 10-digit mobile number');
  if (!/^\S+@\S+\.\S+$/.test(d.email)) throw new Error('Enter a valid email');
  if (!d.address.trim()) throw new Error('Address is required');
  const room=p.rooms.find(r=>r.id===d.roomId && r.propertyId===d.propertyId);
  if (!room || room.status!=='active' || isOccupied(p,room.id)) throw new Error('Selected room is unavailable');
  if (!datePattern.test(d.moveIn) || Number.isNaN(Date.parse(d.moveIn))) throw new Error('Valid move-in date required');
  if (!(d.documents.some(x=>x.category==='identity') && d.documents.some(x=>x.category==='photo'))) throw new Error('Identity proof and photo metadata are required');
  if (d.documents.some(x=>x.size>2_000_000 || x.size<=0)) throw new Error('Each document must be 2MB or less');
}
export function submitEnrollment(p:Portfolio,d:EnrollmentDraft,id:string,at:string):Portfolio {
  validateDraft(p,d);
  if ((p.enrollments||[]).some(e=>e.phone===d.phone && e.status==='pending')) throw new Error('This phone already has a pending application');
  const row:Enrollment={...d,id,submittedAt:at,status:'pending',rejectionReason:'',decisionAt:null,approvedTenantId:null,approvedTenancyId:null};
  return {...p,enrollments:[...(p.enrollments||[]),row]};
}
export function decideEnrollment(p:Portfolio,id:string,decision:'approved'|'rejected',reason:string,at:string,newTenantId:string,newTenancyId:string):Portfolio {
  const e=(p.enrollments||[]).find(x=>x.id===id);
  if (!e || e.status!=='pending') throw new Error('Only pending applications can be reviewed');
  if (decision==='rejected') {
    if (reason.trim().length<3) throw new Error('Rejection reason is required');
    return {...p,enrollments:(p.enrollments||[]).map(x=>x.id===id?{...x,status:'rejected' as const,decisionAt:at,rejectionReason:reason.trim()}:x)};
  }
  validateDraft(p,e);
  const existing=p.tenants.find(t=>t.phone===e.phone);
  if(existing && p.tenancies.some(t=>t.tenantId===existing.id && t.status==='active')) throw new Error('Applicant already has an active tenancy');
  const tenantId=existing?.id||newTenantId;
  const withTenant:Portfolio={...p,tenants:existing?p.tenants:[...p.tenants,{id:tenantId,name:e.applicantName,phone:e.phone,email:e.email,emergencyContact:e.emergencyContact,notes:`Address: ${e.address}`}]};
  const assigned=assignTenant(withTenant,tenantId,e.roomId,e.moveIn);
  const created=assigned.tenancies[assigned.tenancies.length-1];
  return {...assigned,tenancies:assigned.tenancies.map(t=>t.id===created.id?{...t,id:newTenancyId}:t),enrollments:(p.enrollments||[]).map(x=>x.id===id?{...x,status:'approved' as const,decisionAt:at,approvedTenantId:tenantId,approvedTenancyId:newTenancyId}:x)};
}
export function fileMetadata(files: FileList|null,category:EnrollmentDocument['category']):EnrollmentDocument[] {
  return Array.from(files||[]).map(f=>({id:crypto.randomUUID(),name:f.name,size:f.size,type:f.type,category}));
}
