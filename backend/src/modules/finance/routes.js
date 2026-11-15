const r=require('express').Router();
const mongoose=require('mongoose');const {z}=require('zod');const M=require('../../models');
const {auth,roles}=require('../../core/auth');const {parse}=require('../../core/validation');const {asyncRoute,fail}=require('../../core/errors');
const F=require('../../core/finance-rules');
const {notifyOrganizationRole,notifyTenant}=require('../../core/notifications');
r.use(auth);
const owner=roles('owner','manager');
function org(req){if(!req.actor.organizationId)fail(403,'Membership required');return req.actor.organizationId}
function ensureOwnerOrTenant(req,tenantId){if(req.actor.role==='tenant'&&String(req.actor.tenantId)!==String(tenantId))fail(403,'Tenant access denied')}
const {runTx,balanceFor,lockInvoice,recordRevision,initialInvoiceItems}=require('../../core/invoice-accounting');
const id=z.string().regex(/^[a-f\d]{24}$/i);
const amount=z.number().int().positive().refine(Number.isSafeInteger);
const item=z.object({kind:z.enum(['rent','electricity','maintenance','other']),label:z.string().trim().min(2).max(180),amountPaise:amount});
async function invoiceFor(req,invoiceId,session){const invoice=await M.Invoice.findOne({_id:invoiceId,organizationId:org(req)}).session(session||null);if(!invoice)fail(404,'Invoice not found');ensureOwnerOrTenant(req,invoice.tenantId);return invoice}
async function audit(req,event,type,entityId,details,session){await M.AuditLog.create([{organizationId:org(req),actorId:req.actor.id,event,entityType:type,entityId:String(entityId),details}],{session})}

r.post('/invoices/generate',owner,asyncRoute(async(req,res)=>{
  const b=parse(z.object({month:z.string(),dueDay:z.number().int().min(1).max(28).default(5),otherCharges:z.array(z.object({tenancyId:id,label:z.string().trim().min(2).max(180),amountPaise:amount}).strict()).max(200).default([])}).strict(),req.body);
  const {first,last}=F.monthBounds(b.month),organizationId=org(req);
  const tenancies=await M.Tenancy.find({organizationId,moveIn:{$lte:last},$or:[{moveOut:null},{moveOut:{$gte:first}}]});
  const tenancyIds=new Set(tenancies.map(t=>String(t.id)));
  if(b.otherCharges.some(charge=>!tenancyIds.has(charge.tenancyId)))fail(400,'An extra charge references a tenancy outside this billing period');
  const chargesByTenancy=new Map();
  for(const charge of b.otherCharges){const rows=chargesByTenancy.get(charge.tenancyId)||[];rows.push({kind:'other',label:charge.label,amountPaise:charge.amountPaise});chargesByTenancy.set(charge.tenancyId,rows)}
  const results=[];
  for(const t of tenancies){
    const result=await runTx(async session=>{
      const room=await M.Room.findOne({_id:t.roomId,organizationId}).session(session);if(!room)fail(409,'Tenancy room missing');
      const key=`${t.id}:${b.month}`;if(await M.Invoice.exists({organizationId,key}).session(session))return null;
      const originalItems=[...await initialInvoiceItems(organizationId,room,t,b.month,session),...(chargesByTenancy.get(String(t.id))||[])];
      const total=F.sum(originalItems);const [invoice]=await M.Invoice.create([{organizationId,key,tenancyId:t.id,tenantId:t.tenantId,propertyId:room.propertyId,roomId:room.id,month:b.month,issuedAt:first,dueDate:F.dueDate(b.month,b.dueDay),originalItems}],{session});
      await M.LedgerEntry.create([{organizationId,tenantId:t.tenantId,invoiceId:invoice.id,sourceType:'invoice',sourceId:String(invoice.id),debitPaise:total,creditPaise:0,description:'Invoice '+b.month}],{session});
      await recordRevision(invoice,'original','Original invoice',session,req.actor.id);await notifyTenant(organizationId,t.tenantId,{type:'invoice',title:'New rent invoice',body:`Invoice for ${b.month} is ready for room ${room.number}.`,relatedInvoiceId:invoice.id},session);await audit(req,'invoice.created','Invoice',invoice.id,{month:b.month,otherCharges:chargesByTenancy.get(String(t.id))||[]},session);return invoice
    });if(result)results.push(result)
  }
  res.status(201).json({created:results.length,data:results})
}));
r.get('/invoices', asyncRoute(async (req, res) => {
  const q = { organizationId: org(req) };
  if (req.actor.role === 'tenant') {
    if (!req.actor.tenantId) fail(403, 'Tenant not linked');
    q.tenantId = req.actor.tenantId;
  }
  const invoices = await M.Invoice.find(q).sort({ createdAt: -1 }).limit(500);
  const ids = invoices.map((invoice) => invoice.id);
  const roomRows = await M.Room.find({ _id: { $in: invoices.map((invoice) => invoice.roomId).filter(Boolean) }, organizationId: org(req) }).select('_id number propertyId');
  const propertyRows = await M.Property.find({ _id: { $in: roomRows.map((room) => room.propertyId) }, organizationId: org(req) }).select('_id name');
  const roomById = new Map(roomRows.map((room) => [String(room.id), room]));
  const propertyById = new Map(propertyRows.map((property) => [String(property.id), property]));
  const [entries, penalties] = ids.length ? await Promise.all([
    M.LedgerEntry.find({ organizationId: org(req), invoiceId: { $in: ids }, sourceType: { $in: ['charge', 'adjustment'] } })
      .select('invoiceId chargeKind description debitPaise creditPaise').lean(),
    M.Penalty.find({ organizationId: org(req), invoiceId: { $in: ids } })
      .select('invoiceId amountPaise').lean(),
  ]) : [[], []];
  const byInvoice = new Map();
  for (const row of entries) {
    const key = String(row.invoiceId);
    const current = byInvoice.get(key) || { electricityPaise: 0, otherChargesPaise: 0 };
    const amount = (row.debitPaise || 0) - (row.creditPaise || 0);
    if (row.chargeKind === 'electricity' || /^electricity:/i.test(row.description || '')) current.electricityPaise += amount;
    else current.otherChargesPaise += amount;
    byInvoice.set(key, current);
  }
  const penaltyByInvoice = new Map();
  for (const row of penalties) {
    const key = String(row.invoiceId);
    penaltyByInvoice.set(key, (penaltyByInvoice.get(key) || 0) + row.amountPaise);
  }
  res.json({ data: invoices.map((invoice) => {
    const room = roomById.get(String(invoice.roomId));
    const property = room && propertyById.get(String(room.propertyId));
    const basePaise = F.sum(invoice.originalItems.filter((item) => item.kind === 'rent'));
    const originalElectricityPaise = F.sum(invoice.originalItems.filter((item) => item.kind === 'electricity'));
    const originalOtherChargesPaise = F.sum(invoice.originalItems.filter((item) => item.kind !== 'rent' && item.kind !== 'electricity'));
    const charges = byInvoice.get(String(invoice.id)) || { electricityPaise: 0, otherChargesPaise: 0 };
    const penaltyPaise = penaltyByInvoice.get(String(invoice.id)) || 0;
    return {
      ...invoice.toObject(), roomNumber: room?.number || '', propertyName: property?.name || '', basePaise,
      electricityPaise: originalElectricityPaise + charges.electricityPaise,
      otherChargesPaise: originalOtherChargesPaise + charges.otherChargesPaise, penaltyPaise,
      totalPaise: basePaise + originalElectricityPaise + originalOtherChargesPaise + charges.electricityPaise + charges.otherChargesPaise + penaltyPaise,
    };
  }) });
}));
r.get('/invoices/:id/balance',asyncRoute(async(req,res)=>{const inv=await invoiceFor(req,req.params.id);res.json({data:{invoiceId:inv.id,...await balanceFor(inv)}})}));
r.get('/invoices/:id/revisions',asyncRoute(async(req,res)=>{const inv=await invoiceFor(req,req.params.id);res.json({data:await M.InvoiceRevision.find({organizationId:org(req),invoiceId:inv.id}).sort({revision:1})})}));
r.post('/invoices/:id/charges',owner,asyncRoute(async(req,res)=>{const b=parse(z.object({kind:z.enum(['maintenance','other','electricity']),label:z.string().trim().min(2),amountPaise:amount,idempotencyKey:z.string().trim().min(8)}),req.body);const result=await runTx(async session=>{const inv=await invoiceFor(req,req.params.id,session);await lockInvoice(inv,session);const sourceId=`charge:${inv.id}:${b.idempotencyKey}`;if(await M.LedgerEntry.exists({organizationId:org(req),sourceType:'charge',sourceId}).session(session))fail(409,'Charge already applied');await M.LedgerEntry.create([{organizationId:org(req),tenantId:inv.tenantId,invoiceId:inv.id,sourceType:'charge',sourceId,debitPaise:b.amountPaise,creditPaise:0,description:`${b.kind}: ${b.label}`}],{session});const rev=await recordRevision(inv,'charge',b.label,session,req.actor.id);await audit(req,'invoice.charge','Invoice',inv.id,b,session);return rev});res.status(201).json({data:result})}));

const proof=z.object({name:z.string().trim().min(1).max(180),size:z.number().int().positive().max(10_000_000),type:z.enum(['image/jpeg','image/png','application/pdf'])});
r.post('/payments',asyncRoute(async(req,res)=>{const b=parse(z.object({invoiceId:id,amountPaise:amount,method:z.enum(['upi','bank','cash']),reference:z.string(),proof:proof.optional()}),req.body);const inv=await invoiceFor(req,b.invoiceId);if(req.actor.role==='tenant'&&!b.proof)fail(400,'Tenant payment proof required');const due=await balanceFor(inv);if(b.amountPaise>due.balancePaise)fail(409,'Payment exceeds outstanding balance');const ref=F.normalizeReference(b.reference);const data=await M.Payment.create({...b,organizationId:org(req),tenantId:inv.tenantId,reference:b.reference.trim(),referenceKey:ref,submittedAt:new Date()});if(req.actor.role==='tenant')await notifyOrganizationRole(org(req),['owner','manager'],{type:'payment',title:'Payment submitted',body:`${b.method.toUpperCase()} payment submitted for invoice ${inv.month}.` ,relatedInvoiceId:inv.id});res.status(201).json({data})}));
r.get('/payments',asyncRoute(async(req,res)=>{const q={organizationId:org(req)};if(req.actor.role==='tenant'){if(!req.actor.tenantId)fail(403,'Tenant not linked');q.tenantId=req.actor.tenantId}res.json({data:await M.Payment.find(q).sort({createdAt:-1}).limit(500)})}));
r.post('/payments/:id/verify',owner,asyncRoute(async(req,res)=>{const result=await runTx(async session=>{const payment=await M.Payment.findOne({_id:req.params.id,organizationId:org(req),status:'submitted'}).session(session);if(!payment)fail(409,'Payment already decided or missing');const inv=await invoiceFor(req,payment.invoiceId,session);await lockInvoice(inv,session);const balance=await balanceFor(inv,session);F.allocationPlan(balance.balancePaise,payment.amountPaise);payment.status='verified';payment.decidedAt=new Date();await payment.save({session});await M.PaymentAllocation.create([{organizationId:org(req),paymentId:payment.id,invoiceId:inv.id,tenantId:inv.tenantId,amountPaise:payment.amountPaise}],{session});await M.LedgerEntry.create([{organizationId:org(req),tenantId:inv.tenantId,invoiceId:inv.id,sourceType:'payment',sourceId:String(payment.id),debitPaise:0,creditPaise:payment.amountPaise,description:'Verified '+payment.method+' payment'}],{session});await notifyTenant(org(req),inv.tenantId,{type:'payment',title:'Payment verified',body:`Your ${payment.method} payment was verified for invoice ${inv.month}.`,relatedInvoiceId:inv.id},session);await audit(req,'payment.verified','Payment',payment.id,{amountPaise:payment.amountPaise},session);return payment});res.json({data:result})}));
r.post('/payments/:id/reject',owner,asyncRoute(async(req,res)=>{const b=parse(z.object({reason:z.string().trim().min(4).max(500)}),req.body);const result=await runTx(async session=>{const payment=await M.Payment.findOne({_id:req.params.id,organizationId:org(req),status:'submitted'}).session(session);if(!payment)fail(409,'Payment already decided or missing');const inv=await M.Invoice.findOne({_id:payment.invoiceId,organizationId:org(req)}).session(session);payment.status='rejected';payment.rejectionReason=b.reason;payment.decidedAt=new Date();await payment.save({session});if(inv)await notifyTenant(org(req),payment.tenantId,{type:'payment',title:'Payment needs attention',body:`Your payment for invoice ${inv.month} was not verified: ${b.reason}`,relatedInvoiceId:inv.id},session);await audit(req,'payment.rejected','Payment',payment.id,{reason:b.reason},session);return payment});res.json({data:result})}));
r.post('/invoices/:id/penalty',owner,asyncRoute(async(req,res)=>{const b=parse(z.object({today:z.string(),rule:z.object({graceDays:z.number().int().min(0).max(365).default(15),mode:z.enum(['fixed','per-day','percentage']),value:amount})}),req.body);F.ensureDate(b.today);const result=await runTx(async session=>{const inv=await invoiceFor(req,req.params.id,session);await lockInvoice(inv,session);if(await M.Penalty.exists({invoiceId:inv.id,organizationId:org(req)}).session(session))fail(409,'Penalty already applied');const balance=await balanceFor(inv,session);if(balance.balancePaise<=0)fail(409,'Invoice already settled');const value=F.penaltyAmount(Math.max(0,balance.balancePaise),Math.max(0,F.dateDiff(inv.dueDate,b.today)),b.rule);if(!value)fail(409,'Penalty not due');F.money(value,true);const [penalty]=await M.Penalty.create([{organizationId:org(req),invoiceId:inv.id,appliedAt:b.today,amountPaise:value,rule:b.rule}],{session});await M.LedgerEntry.create([{organizationId:org(req),tenantId:inv.tenantId,invoiceId:inv.id,sourceType:'penalty',sourceId:String(penalty.id),debitPaise:value,creditPaise:0,description:'Overdue penalty'}],{session});await recordRevision(inv,'penalty','Late fee',session,req.actor.id);await audit(req,'penalty.applied','Penalty',penalty.id,{invoiceId:inv.id,value},session);return penalty});res.status(201).json({data:result})}));
r.post('/ledger/adjustments',owner,asyncRoute(async(req,res)=>{const b=parse(z.object({invoiceId:id,amountPaise:z.number().int().refine(Number.isSafeInteger),reason:z.string().trim().min(5),idempotencyKey:z.string().trim().min(8)}),req.body);if(b.amountPaise===0)fail(400,'Adjustment must be nonzero');F.money(Math.abs(b.amountPaise),true);const result=await runTx(async session=>{const inv=await invoiceFor(req,b.invoiceId,session);await lockInvoice(inv,session);const current=await balanceFor(inv,session);if(current.totalPaise+b.amountPaise<current.paidPaise)fail(409,'Adjustment would exceed outstanding accounting balance');const sourceId=`adjust:${b.idempotencyKey}`;if(await M.LedgerEntry.exists({organizationId:org(req),sourceType:'adjustment',sourceId}).session(session))fail(409,'Adjustment already applied');const [entry]=await M.LedgerEntry.create([{organizationId:org(req),tenantId:inv.tenantId,invoiceId:inv.id,sourceType:'adjustment',sourceId,debitPaise:Math.max(0,b.amountPaise),creditPaise:Math.max(0,-b.amountPaise),description:b.reason}],{session});await recordRevision(inv,'adjustment',b.reason,session,req.actor.id);await audit(req,'ledger.adjustment','LedgerEntry',entry.id,{reason:b.reason,amountPaise:b.amountPaise},session);return entry});res.status(201).json({data:result})}));
r.get('/tenants/:id/ledger',asyncRoute(async(req,res)=>{ensureOwnerOrTenant(req,req.params.id);const entries=await M.LedgerEntry.find({organizationId:org(req),tenantId:req.params.id}).sort({occurredAt:1,_id:1});let total=0;res.json({data:entries.map(e=>{total+=e.debitPaise-e.creditPaise;return {...e.toObject(),balancePaise:total}}),balancePaise:total})}));

r.post('/deposits',owner,asyncRoute(async(req,res)=>{const b=parse(z.object({tenancyId:id,amountPaise:amount,reference:z.string().trim().min(3)}),req.body);const result=await runTx(async session=>{const tenancy=await M.Tenancy.findOne({_id:b.tenancyId,organizationId:org(req)}).session(session);if(!tenancy)fail(404,'Tenancy not found');const [deposit]=await M.Deposit.create([{organizationId:org(req),tenancyId:tenancy.id,amountPaise:b.amountPaise,deductionsPaise:0,refundPaise:0,status:'held'}],{session});await M.DepositTransaction.create([{organizationId:org(req),depositId:deposit.id,tenancyId:tenancy.id,type:'received',amountPaise:b.amountPaise,reason:'External deposit receipt',referenceKey:b.reference.trim().toLowerCase(),createdBy:req.actor.id}],{session});await audit(req,'deposit.received','Deposit',deposit.id,{amountPaise:b.amountPaise},session);return deposit});res.status(201).json({data:result})}));
r.get('/deposits',asyncRoute(async(req,res)=>{const q={organizationId:org(req)};if(req.actor.role==='tenant'){if(!req.actor.tenantId)fail(403,'Tenant not linked');const tenancies=await M.Tenancy.find({organizationId:org(req),tenantId:req.actor.tenantId}).select('_id');q.tenancyId={$in:tenancies.map(t=>t.id)}}res.json({data:await M.Deposit.find(q)})}));
r.post('/deposits/:id/settle',owner,asyncRoute(async(req,res)=>{const b=parse(z.object({deductionsPaise:z.number().int().nonnegative().refine(Number.isSafeInteger),reason:z.string().trim().min(5),refundReference:z.string().trim().min(3)}),req.body);const result=await runTx(async session=>{const deposit=await M.Deposit.findOne({_id:req.params.id,organizationId:org(req),status:'held'}).session(session);if(!deposit)fail(409,'Deposit missing or already settled');const tenancy=await M.Tenancy.findOne({_id:deposit.tenancyId,organizationId:org(req)}).session(session);if(!tenancy||tenancy.status!=='ended')fail(409,'Deposit settles after move-out only');const refund=F.settlementAmount(deposit.amountPaise,b.deductionsPaise);deposit.deductionsPaise=b.deductionsPaise;deposit.refundPaise=refund;deposit.status='settled';deposit.settledAt=new Date();await deposit.save({session});const rows=[];if(b.deductionsPaise)rows.push({organizationId:org(req),depositId:deposit.id,tenancyId:deposit.tenancyId,type:'deduction',amountPaise:b.deductionsPaise,reason:b.reason,createdBy:req.actor.id});if(refund)rows.push({organizationId:org(req),depositId:deposit.id,tenancyId:deposit.tenancyId,type:'refund',amountPaise:refund,referenceKey:b.refundReference.toLowerCase(),reason:'Externally refunded',createdBy:req.actor.id});if(rows.length)await M.DepositTransaction.create(rows,{session,ordered:true});await audit(req,'deposit.settled','Deposit',deposit.id,{refundPaise:refund,deductionsPaise:b.deductionsPaise},session);return deposit});res.json({data:result})}));
r.get('/reports/reconciliation',owner,asyncRoute(async(req,res)=>{const month=String(req.query.month||'');F.monthBounds(month);const organizationId=org(req);const invoices=await M.Invoice.find({organizationId,month}).lean();const ids=invoices.map(i=>i._id);const [payments,penalties,adjustments,allocations]=await Promise.all([M.Payment.find({organizationId,invoiceId:{$in:ids},status:'verified'}),M.Penalty.find({organizationId,invoiceId:{$in:ids}}),M.LedgerEntry.find({organizationId,invoiceId:{$in:ids},sourceType:{$in:['adjustment','charge']}}),M.PaymentAllocation.find({organizationId,invoiceId:{$in:ids}})]);const billed=invoices.reduce((t,i)=>t+F.sum(i.originalItems),0);const extra=penalties.reduce((t,p)=>t+p.amountPaise,0)+adjustments.reduce((t,a)=>t+a.debitPaise-a.creditPaise,0);const verified=payments.reduce((t,p)=>t+p.amountPaise,0),allocated=allocations.reduce((t,a)=>t+a.amountPaise,0);res.json({data:{month,invoiceCount:invoices.length,billedPaise:billed,additionalPaise:extra,verifiedPaise:verified,allocatedPaise:allocated,outstandingPaise:billed+extra-allocated,reconciled:verified===allocated}})}));
// Read-only transaction reporting shared by owner workspaces and platform admins.
const financeReaders=roles('owner','manager','admin');
function reportScope(req){if(req.actor.role==='admin')return {};return {organizationId:org(req)}}
function dayBounds(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))fail(400,'Date must use YYYY-MM-DD');const start=new Date(`${value}T00:00:00+05:30`),end=new Date(start.getTime()+86400000);if(Number.isNaN(start.getTime()))fail(400,'Invalid date');return {start,end}}
function escaped(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
async function transactionRows(req){
 const scope=reportScope(req),q=req.query;
 const invoiceQuery={...scope};if(req.actor.role==='admin'&&q.ownerId){if(!/^[a-f\d]{24}$/i.test(String(q.ownerId)))fail(400,'Invalid ownerId');invoiceQuery.organizationId=q.ownerId}
 for(const key of ['propertyId','roomId','tenantId'])if(q[key]){if(!/^[a-f\d]{24}$/i.test(String(q[key])))fail(400,`Invalid ${key}`);invoiceQuery[key]=q[key]}
 if(q.month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(q.month)))fail(400,'Month must use YYYY-MM');invoiceQuery.month=q.month}
 const matchingInvoices=await M.Invoice.find(invoiceQuery).select('_id organizationId tenantId propertyId roomId month key originalItems').limit(20000).lean();
 const byId=new Map(matchingInvoices.map(i=>[String(i._id),i]));
 const paymentQuery={...scope};if(q.status)paymentQuery.status=q.status;if(q.method)paymentQuery.method=q.method;
 if(q.startDate||q.endDate){const start=q.startDate?dayBounds(String(q.startDate)).start:new Date('1970-01-01T00:00:00Z');const end=q.endDate?dayBounds(String(q.endDate)).end:new Date('2999-01-01T00:00:00Z');if(start>=end)fail(400,'Start date must be before end date');paymentQuery.submittedAt={$gte:start,$lt:end}}
 let payments=await M.Payment.find(paymentQuery).sort({submittedAt:-1,_id:-1}).limit(20000).lean();
 payments=payments.filter(p=>byId.has(String(p.invoiceId)));
 // Older verified receipts may survive in the immutable ledger without their original Payment document.
 // Surface those ledger credits too, while suppressing entries whose Payment row still exists.
 const paymentKeys=new Set(payments.map(p=>String(p._id)));
 const legacyQuery={...scope,sourceType:'payment',creditPaise:{$gt:0},invoiceId:{$in:[...byId.values()].map(i=>i._id)}};
 if(paymentQuery.submittedAt)legacyQuery.occurredAt=paymentQuery.submittedAt;
 const legacyEntries=await M.LedgerEntry.find(legacyQuery).sort({occurredAt:-1,_id:-1}).limit(20000).lean();
 const legacySourceIds=legacyEntries.map(x=>x.sourceId).filter(x=>/^[a-f\d]{24}$/i.test(x||''));
 const existingLegacyPayments=await M.Payment.find({...scope,_id:{$in:legacySourceIds}}).select('_id').lean();
 const existingLegacyIds=new Set(existingLegacyPayments.map(x=>String(x._id)));
 for(const entry of legacyEntries){if(paymentKeys.has(String(entry.sourceId))||existingLegacyIds.has(String(entry.sourceId)))continue;const id=/^[a-f\d]{24}$/i.test(entry.sourceId||'')?entry.sourceId:String(entry._id);payments.push({_id:id,invoiceId:entry.invoiceId,tenantId:entry.tenantId,amountPaise:entry.creditPaise,method:'ledger',reference:entry.description||'Legacy ledger receipt',status:'verified',submittedAt:entry.occurredAt,legacy:true})}
 const search=q.search?new RegExp(escaped(String(q.search).slice(0,100)),'i'):null;
 const tenantIds=[...new Set([...byId.values()].map(i=>String(i.tenantId)))];
 const propertyIds=[...new Set([...byId.values()].map(i=>String(i.propertyId)).filter(Boolean))];
 const roomIds=[...new Set([...byId.values()].map(i=>String(i.roomId)).filter(Boolean))];
 const [tenants,properties,rooms,allocations]=await Promise.all([
  M.Tenant.find({...scope,_id:{$in:tenantIds}}).select('name phone').lean(),M.Property.find({...scope,_id:{$in:propertyIds}}).select('name').lean(),M.Room.find({...scope,_id:{$in:roomIds}}).select('number floorId').lean(),M.PaymentAllocation.find({...scope,paymentId:{$in:payments.map(p=>p._id)}}).lean()
 ]);
 const tenantMap=new Map(tenants.map(x=>[String(x._id),x])),propertyMap=new Map(properties.map(x=>[String(x._id),x])),roomMap=new Map(rooms.map(x=>[String(x._id),x]));
 const allocationsByPayment=new Map();for(const a of allocations){const key=String(a.paymentId);allocationsByPayment.set(key,(allocationsByPayment.get(key)||0)+a.amountPaise)}
 let rows=payments.map(p=>{const i=byId.get(String(p.invoiceId)),t=tenantMap.get(String(i.tenantId)),property=propertyMap.get(String(i.propertyId)),room=roomMap.get(String(i.roomId));return {id:String(p._id),transactionId:String(p._id),date:p.submittedAt,ownerId:String(i.organizationId),property:property?.name||'—',propertyId:String(i.propertyId||''),floorId:String(room?.floorId||''),room:room?.number||'—',roomId:String(i.roomId||''),tenant:t?.name||'—',tenantId:String(i.tenantId),phone:t?.phone||'',invoiceNumber:i.key,billingMonth:i.month,category:(i.originalItems||[]).map(x=>x.kind).join(', ')||'rent',method:p.method,reference:p.reference,grossAmountPaise:p.amountPaise,allocatedAmountPaise:allocationsByPayment.get(String(p._id))||0,status:p.status,proof:p.proof,invoiceId:String(i._id)}});
 if(q.transactionId)rows=rows.filter(x=>x.transactionId===String(q.transactionId)||x.transactionId.toLowerCase().includes(String(q.transactionId).toLowerCase()));
 if(q.category)rows=rows.filter(x=>x.category.split(', ').includes(String(q.category)));
 if(q.floorId)rows=rows.filter(x=>x.floorId===String(q.floorId));
 if(search)rows=rows.filter(x=>search.test([x.tenant,x.phone,x.transactionId,x.reference,x.invoiceNumber,x.property,x.room].join(' ')));
 return rows;
}
r.get('/summary',financeReaders,asyncRoute(async(req,res)=>{const rows=await transactionRows(req);const verified=rows.filter(x=>x.status==='verified');const invoiceQuery={...reportScope(req)};if(req.query.month)invoiceQuery.month=String(req.query.month);if(req.actor.role==='admin'&&req.query.ownerId)invoiceQuery.organizationId=String(req.query.ownerId);for(const key of ['propertyId','roomId','tenantId'])if(req.query[key])invoiceQuery[key]=String(req.query[key]);const [invoices,depositReceived,depositRefunds]=await Promise.all([M.Invoice.find(invoiceQuery).select('_id originalItems').lean(),M.DepositTransaction.find({...reportScope(req),type:'received'}).select('amountPaise').lean(),M.DepositTransaction.find({...reportScope(req),type:'refund'}).select('amountPaise').lean()]);const invoiceIds=invoices.map(x=>x._id);const ledger=await M.LedgerEntry.find({...reportScope(req),invoiceId:{$in:invoiceIds}}).select('debitPaise creditPaise').lean();const invoiceMap=new Map(invoices.map(x=>[String(x._id),x]));const sum=list=>list.reduce((n,x)=>n+(x.allocatedAmountPaise||0),0);const kinds=['rent','electricity','maintenance','other'];const categoryTotals=Object.fromEntries(kinds.map(k=>[k,0]));for(const row of verified){const items=invoiceMap.get(row.invoiceId)?.originalItems||[],total=items.reduce((n,x)=>n+x.amountPaise,0);let used=0;items.forEach((item,index)=>{const part=index===items.length-1?(row.allocatedAmountPaise||0)-used:Math.floor((row.allocatedAmountPaise||0)*(item.amountPaise||0)/(total||1));categoryTotals[item.kind]=(categoryTotals[item.kind]||0)+part;used+=part})}const pending=rows.filter(x=>x.status==='submitted').reduce((n,x)=>n+x.grossAmountPaise,0);const billed=invoices.reduce((n,i)=>n+(i.originalItems||[]).reduce((a,x)=>a+x.amountPaise,0),0);const outstandingPaise=Math.max(0,ledger.reduce((n,x)=>n+x.debitPaise-x.creditPaise,0));const depositPaise=depositReceived.reduce((n,x)=>n+x.amountPaise,0),refundPaise=depositRefunds.reduce((n,x)=>n+x.amountPaise,0);res.json({data:{verifiedPaise:sum(verified),rentPaise:categoryTotals.rent,electricityPaise:categoryTotals.electricity,maintenancePaise:categoryTotals.maintenance,otherPaise:categoryTotals.other,depositPaise,pendingPaise:pending,billedPaise:billed,outstandingPaise,refundPaise,count:rows.length}})}));
r.get('/',financeReaders,asyncRoute(async(req,res)=>{const rows=await transactionRows(req);const sort=req.query.sort==='amount'?((a,b)=>Number(b.grossAmountPaise)-Number(a.grossAmountPaise)):req.query.sort==='date-asc'?((a,b)=>new Date(a.date||0)-new Date(b.date||0)):((a,b)=>new Date(b.date||0)-new Date(a.date||0));rows.sort(sort);const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||25));res.json({data:rows.slice((page-1)*limit,page*limit),page,limit,total:rows.length,totalPages:Math.ceil(rows.length/limit)})}));
r.get('/monthly',financeReaders,asyncRoute(async(req,res)=>{const scope=reportScope(req);const invoices=await M.Invoice.find(scope).select('month originalItems').sort({month:1}).lean();const payments=await M.Payment.find({...scope,status:'verified'}).select('invoiceId amountPaise').lean();const paymentInvoiceIds=[...new Set(payments.map(p=>String(p.invoiceId)))];const paymentInvoices=await M.Invoice.find({_id:{$in:paymentInvoiceIds},...scope}).select('month').lean();const monthById=new Map(paymentInvoices.map(x=>[String(x._id),x.month]));const months=new Map();for(const i of invoices){const x=months.get(i.month)||{month:i.month,billedPaise:0,verifiedPaise:0};x.billedPaise+=(i.originalItems||[]).reduce((n,v)=>n+v.amountPaise,0);months.set(i.month,x)}for(const p of payments){const m=monthById.get(String(p.invoiceId));if(m){const x=months.get(m)||{month:m,billedPaise:0,verifiedPaise:0};x.verifiedPaise+=p.amountPaise;months.set(m,x)}}res.json({data:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({...x,outstandingPaise:Math.max(0,x.billedPaise-x.verifiedPaise)}))})}));
r.get('/daily',financeReaders,asyncRoute(async(req,res)=>{const scope=reportScope(req);const rows=await transactionRows(req);const byDate=new Map();for(const row of rows){const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.date));const x=byDate.get(date)||{date,count:0,rentPaise:0,otherPaise:0,refundPaise:0,netPaise:0};x.count++;if(row.status==='verified'){x.rentPaise+=row.allocatedAmountPaise;x.netPaise+=row.allocatedAmountPaise}byDate.set(date,x)}res.json({data:[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date))})}));
r.get('/export.csv',financeReaders,asyncRoute(async(req,res)=>{const rows=await transactionRows(req);const columns=['transactionId','date','ownerId','property','floorId','room','tenant','phone','invoiceNumber','billingMonth','category','method','reference','grossAmountPaise','allocatedAmountPaise','status'];const csv=[columns.join(','),...rows.map(row=>columns.map(k=>'"'+String(row[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="roomrent-transactions.csv"');res.send(csv)}));
module.exports=r;
