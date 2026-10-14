import type {Portfolio} from '../property-management/types';
import type {FinanceState} from '../finance/engine';
import {invoiceTotal,invoicePaid} from '../finance/engine';
export type TicketStatus='new'|'in-progress'|'resolved';
export type Attachment={name:string;size:number;type:string};
export type Ticket={id:string;tenantId:string;roomId:string;propertyId:string;title:string;description:string;category:'plumbing'|'electrical'|'cleaning'|'other';status:TicketStatus;attachment?:Attachment;createdAt:string;updatedAt:string;updates:{status:TicketStatus;remark:string;at:string}[]};
export type Notice={id:string;recipientRole:'owner'|'tenant';tenantId?:string;title:string;message:string;kind:'maintenance'|'payment'|'rent'|'approval'|'general';createdAt:string;readAt?:string};
export type DocumentRecord={id:string;tenantId:string;category:'identity'|'photo'|'agreement'|'other';file:Attachment;addedAt:string;verification:'pending'|'verified'|'rejected';reason?:string};
export type Deposit={id:string;tenancyId:string;tenantId:string;amountPaise:number;collectedAt:string;status:'held'|'settled';deductions:{reason:string;amountPaise:number}[];refundPaise?:number;settledAt?:string};
export type Operations={tickets:Ticket[];notices:Notice[];documents:DocumentRecord[];deposits:Deposit[]};
export const initialOperations=():Operations=>({tickets:[],notices:[],documents:[],deposits:[]});
const uuid=()=>crypto.randomUUID();const now=()=>new Date().toISOString();
export function validateAttachment(a:Attachment){if(!a.name.trim()||!Number.isInteger(a.size)||a.size<1||a.size>5_000_000||!['image/jpeg','image/png','application/pdf','video/mp4'].includes(a.type))throw Error('File must be JPG, PNG, PDF or MP4 under 5 MB');return a;}
export function notify(s:Operations,recipientRole:Notice['recipientRole'],kind:Notice['kind'],title:string,message:string,tenantId?:string):Operations{return {...s,notices:[{id:uuid(),recipientRole,tenantId,kind,title,message,createdAt:now()},...s.notices]};}
export function createTicket(s:Operations,p:Portfolio,tenantId:string,title:string,description:string,category:Ticket['category'],attachment?:Attachment):Operations{
 const tenancy=p.tenancies.find(x=>x.tenantId===tenantId&&x.status==='active'&&!x.moveOut);if(!tenancy)throw Error('Active tenancy required');
 const room=p.rooms.find(x=>x.id===tenancy.roomId);if(!room)throw Error('Room not found');
 if(title.trim().length<4||description.trim().length<10||!['plumbing','electrical','cleaning','other'].includes(category))throw Error('Provide a title, description (10+ characters) and category');
 if(attachment)validateAttachment(attachment);
 const ticket:Ticket={id:uuid(),tenantId,roomId:room.id,propertyId:room.propertyId,title:title.trim(),description:description.trim(),category,status:'new',attachment,createdAt:now(),updatedAt:now(),updates:[]};
 return notify({...s,tickets:[ticket,...s.tickets]},'owner','maintenance','New complaint',ticket.title,tenantId);
}
export function updateTicket(s:Operations,id:string,status:TicketStatus,remark:string):Operations{
 const t=s.tickets.find(x=>x.id===id);if(!t)throw Error('Complaint not found');
 if(!remark.trim())throw Error('Update remark is required');
 if(!(t.status==='new'&&status==='in-progress'||t.status==='in-progress'&&status==='resolved'))throw Error('Invalid status transition');
 const at=now();const tickets=s.tickets.map(x=>x.id===id?{...x,status,updatedAt:at,updates:[...x.updates,{status,remark:remark.trim(),at}]}:x);
 return notify({...s,tickets},'tenant','maintenance',`Complaint ${status}`,remark.trim(),t.tenantId);
}
export function markRead(s:Operations,id:string):Operations{return {...s,notices:s.notices.map(n=>n.id===id?{...n,readAt:n.readAt||now()}:n)};}
export function addDocument(s:Operations,tenantId:string,category:DocumentRecord['category'],file:Attachment):Operations{
 if(!tenantId||!['identity','photo','agreement','other'].includes(category))throw Error('Invalid tenant/category');validateAttachment(file);
 return {...s,documents:[{id:uuid(),tenantId,category,file,addedAt:now(),verification:'pending'},...s.documents]};
}
export function reviewDocument(s:Operations,id:string,approve:boolean,reason=''):Operations{
 const d=s.documents.find(x=>x.id===id);if(!d||d.verification!=='pending')throw Error('Document already reviewed or missing');
 if(!approve&&!reason.trim())throw Error('Rejection reason required');
 return notify({...s,documents:s.documents.map(x=>x.id===id?{...x,verification:approve?'verified':'rejected',reason:approve?undefined:reason.trim()} as DocumentRecord:x)},'tenant','approval',approve?'Document verified':'Document rejected',approve?'Your document was verified':reason.trim(),d.tenantId);
}
export function collectDeposit(s:Operations,p:Portfolio,tenancyId:string,amountPaise:number):Operations{
 const tenancy=p.tenancies.find(t=>t.id===tenancyId);if(!tenancy)throw Error('Tenancy not found');
 if(s.deposits.some(d=>d.tenancyId===tenancyId))throw Error('Deposit already recorded for this tenancy');
 if(!Number.isSafeInteger(amountPaise)||amountPaise<=0)throw Error('Invalid deposit');
 return {...s,deposits:[{id:uuid(),tenancyId,tenantId:tenancy.tenantId,amountPaise,collectedAt:now(),status:'held',deductions:[]},...s.deposits]};
}
export function settleDeposit(s:Operations,p:Portfolio,id:string,deductions:Deposit['deductions']):Operations{
 const deposit=s.deposits.find(d=>d.id===id);if(!deposit||deposit.status!=='held')throw Error('Held deposit not found');
 const tenancy=p.tenancies.find(t=>t.id===deposit.tenancyId);if(!tenancy||tenancy.status!=='ended')throw Error('Move-out required before settlement');
 if(deductions.some(d=>!d.reason.trim()||!Number.isSafeInteger(d.amountPaise)||d.amountPaise<0))throw Error('Invalid deduction');
 const total=deductions.reduce((a,d)=>a+d.amountPaise,0);if(total>deposit.amountPaise)throw Error('Deductions cannot exceed deposit');
 return notify({...s,deposits:s.deposits.map(d=>d.id===id?{...d,status:'settled',deductions,refundPaise:d.amountPaise-total,settledAt:now()} as Deposit:d)},'tenant','payment','Deposit settled',`Refund to arrange: ₹${((deposit.amountPaise-total)/100).toFixed(2)} (external/manual)`,deposit.tenantId);
}
export function summarizeFinancial(p:Portfolio,f:FinanceState,propertyId?:string){
 const invoices=f.invoices.filter(i=>!propertyId||i.propertyId===propertyId);const billed=invoices.reduce((a,i)=>a+invoiceTotal(f,i),0);const paid=invoices.reduce((a,i)=>a+invoicePaid(f,i.id),0);
 const rooms=p.rooms.filter(r=>!propertyId||r.propertyId===propertyId);const occupied=rooms.filter(r=>p.tenancies.some(t=>t.roomId===r.id&&t.status==='active'&&!t.moveOut)).length;
 return {billed,paid,outstanding:billed-paid,rooms:rooms.length,occupied,vacant:rooms.filter(r=>r.status==='active').length-occupied,collectionRate:billed?paid/billed*100:0};
}
