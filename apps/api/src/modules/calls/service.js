const mongoose=require('mongoose');const M=require('../../models');const {fail}=require('../../core/errors');
const R=require('../../core/b7-rules');const {events}=require('./events');
const validId=(id,name='ID')=>{if(!mongoose.isValidObjectId(id))fail(400,`Invalid ${name}`);return id;};
const userActor=actor=>({...actor,kind:'user'});
const lockKey=(org,kind,id)=>`${org}:${kind}:${id}`;
const otherParticipant=call=>call.type==='tablet'?{kind:'device',id:String(call.deviceId)}:{kind:'user',id:String(call.recipientId)};
async function activeTenant(tenantId,org,session){
  const tenant=await M.Tenant.findOne({_id:validId(tenantId,'tenant'),organizationId:org,userId:{$ne:null}}).session(session);
  if(!tenant)fail(404,'Active linked tenant not found');
  const tenancy=await M.Tenancy.findOne({organizationId:org,tenantId:tenant.id,status:'active'}).session(session);
  if(!tenancy)fail(409,'Tenant has no active tenancy');
  const room=await M.Room.findOne({_id:tenancy.roomId,organizationId:org}).session(session);
  if(!room)fail(409,'Tenant room missing');
  if(!await M.Membership.exists({organizationId:org,userId:tenant.userId,tenantId:tenant.id,role:'tenant',active:true}).session(session))fail(409,'Tenant has no active linked membership');
  return {tenant,tenancy,room};
}
async function callDestination(actor,b,session){
 const org=actor.organizationId;
 if(!org)fail(403,'Organization required');
 if(actor.role==='tenant'){
   if(b.type!=='tenant')fail(403,'Tenants cannot call tablets');
   if(!actor.tenantId)fail(403,'Tenant profile not linked');
   const {room,tenant}=await activeTenant(actor.tenantId,org,session);
   if(String(tenant.userId)!==String(actor.id))fail(403,'Tenant identity mismatch');
   const recipientId=validId(b.recipientOwnerId,'owner');
   if(!await M.Membership.exists({organizationId:org,userId:recipientId,role:{$in:['owner','manager']},active:true}).session(session))fail(403,'Recipient is not an authorized owner/manager');
   return {type:'tenant',propertyId:room.propertyId,tenantId:actor.tenantId,recipientId,recipient:{kind:'user',id:recipientId}};
 }
 if(!['owner','manager'].includes(actor.role))fail(403,'Only property staff may start calls');
 if(b.type==='tablet'){
   const device=await M.Device.findOne({_id:validId(b.deviceId,'device'),organizationId:org,status:'active',credentialExpiresAt:{$gt:new Date()}}).session(session);
   if(!device)fail(404,'Active paired tablet not found');
   if(!await M.Property.exists({_id:device.propertyId,organizationId:org}).session(session))fail(404,'Property not found');
   return {type:'tablet',propertyId:device.propertyId,deviceId:device.id,recipient:{kind:'device',id:device.id}};
 }
 if(b.type!=='tenant')fail(400,'Invalid call type');
 const {tenant,room}=await activeTenant(b.recipientTenantId,org,session);
 return {type:'tenant',propertyId:room.propertyId,tenantId:tenant.id,recipientId:tenant.userId,recipient:{kind:'user',id:tenant.userId}};
}
async function createCall(actor,b){
 actor=userActor(actor);if(!['owner','manager','tenant'].includes(actor.role))fail(403,'Call initiator not permitted');
 const org=actor.organizationId;const same=await M.CallLog.findOne({organizationId:org,callerId:actor.id,clientRequestId:b.clientRequestId});if(same)return {data:R.sanitizeCall(same),duplicate:true};
 const session=await mongoose.startSession();let call;
 try{await session.withTransaction(async()=>{
   const dest=await callDestination(actor,b,session);if(dest.recipient.kind==='user'&&String(dest.recipient.id)===String(actor.id))fail(400,'Cannot call yourself');
   const now=new Date();[call]=await M.CallLog.create([{organizationId:org,propertyId:dest.propertyId,type:dest.type,callerId:actor.id,recipientId:dest.recipientId||null,tenantId:dest.tenantId||null,deviceId:dest.deviceId||null,initiatorRole:actor.role,clientRequestId:b.clientRequestId,status:'ringing',ringExpiresAt:new Date(now.getTime()+R.RING_MS)}],{session});
   const keys=R.participantKeys(org,actor.id,dest.recipient);
   await M.CallParticipantLock.insertMany(keys.map(key=>({key,organizationId:org,callId:call.id,expiresAt:new Date(now.getTime()+R.RING_MS+30_000)})),{session,ordered:true});
   await M.AuditLog.create([{organizationId:org,actorId:actor.id,event:'call.created',entityType:'CallLog',entityId:String(call.id),details:{type:dest.type,propertyId:String(dest.propertyId)}}],{session});
 });}catch(e){if(e.code===11000){const replay=await M.CallLog.findOne({organizationId:org,callerId:actor.id,clientRequestId:b.clientRequestId});if(replay)return {data:R.sanitizeCall(replay),duplicate:true};fail(409,'Caller or recipient busy');}throw e;}finally{await session.endSession();}
 const data=R.sanitizeCall(call);events.emit('call.changed',{kind:'incoming',call:data});return {data,duplicate:false};
}
async function getAuthorizedCall(actor,callId,session){validId(callId,'call');const call=await M.CallLog.findOne({_id:callId,organizationId:actor.organizationId}).session(session||null);if(!call)fail(404,'Call not found');if(!R.mayAct(call,actor,'view'))fail(403,'Not a call participant');if(actor.kind==='device'&&String(call.deviceId)!==String(actor.id))fail(403,'Unrelated tablet');return call;}
async function transitionCall(actor,callId,action){
 const session=await mongoose.startSession();let updated;
 try{await session.withTransaction(async()=>{
   const call=await getAuthorizedCall(actor,callId,session);
   if(!R.mayAct(call,actor,action))fail(403,'Action restricted to call participant');
   const next=R.transition(call.status,action);if(!next)fail(409,'Invalid call state transition');
   if(action==='accept')await ensureMediaEligibility(call);
   const now=new Date();if(call.status==='ringing'&&now>call.ringExpiresAt)fail(409,'Call invitation expired');
   const patch={status:next};if(action==='accept')patch.acceptedAt=now;
   if(R.TERMINAL.has(next)){patch.endedAt=now;patch.endedReason=action;}
   updated=await M.CallLog.findOneAndUpdate({_id:call.id,organizationId:actor.organizationId,status:call.status},{$set:patch},{session,new:true});
   if(!updated)fail(409,'Call state changed; please refresh');
   if(R.TERMINAL.has(next))await M.CallParticipantLock.deleteMany({callId:call.id}).session(session);
   if(action==='accept')await M.CallParticipantLock.updateMany({callId:call.id},{$set:{expiresAt:new Date(now.getTime()+R.MAX_CALL_MS+30_000)}},{session});
   await M.AuditLog.create([{organizationId:call.organizationId,actorId:actor.kind==='user'?actor.id:null,event:`call.${next}`,entityType:'CallLog',entityId:String(call.id)}],{session});
 });}finally{await session.endSession();}
 const data=R.sanitizeCall(updated);events.emit('call.changed',{kind:'updated',call:data});return data;
}
async function ensureMediaEligibility(call){
 if(call.type==='tablet'){
   const device=await M.Device.exists({_id:call.deviceId,organizationId:call.organizationId,propertyId:call.propertyId,status:'active',credentialExpiresAt:{$gt:new Date()}});
   if(!device)fail(403,'Tablet no longer authorized');
 }else{
   const linked=await M.Tenant.findOne({_id:call.tenantId,organizationId:call.organizationId});
   if(!linked||!linked.userId)fail(403,'Tenant no longer linked');
   const members=await M.Membership.exists({userId:linked.userId,organizationId:call.organizationId,tenantId:call.tenantId,role:'tenant',active:true});
   if(!members)fail(403,'Tenant membership inactive');
   const active=await M.Tenancy.exists({organizationId:call.organizationId,tenantId:call.tenantId,status:'active'});
   if(!active)fail(403,'Tenant no longer has active tenancy');
 }
}
async function listCalls(actor,limit=50){const n=Math.min(Math.max(Number(limit)||50,1),100);const filter={organizationId:actor.organizationId};if(actor.kind==='device')filter.deviceId=actor.id;else filter.$or=[{callerId:actor.id},{recipientId:actor.id}];const docs=await M.CallLog.find(filter).sort({createdAt:-1}).limit(n);return docs.map(R.sanitizeCall);}
async function closeCalls(filter,reason){const calls=await M.CallLog.find({status:{$in:['ringing','accepted']},...filter}).limit(200);let ended=0;for(const c of calls){const now=new Date();const result=await M.CallLog.findOneAndUpdate({_id:c.id,status:c.status},{$set:{status:reason==='ring-timeout'?'missed':reason==='call-timeout'?'ended':'failed',endedAt:now,endedReason:reason}},{new:true});if(!result)continue;await M.CallParticipantLock.deleteMany({callId:c.id});events.emit('call.changed',{kind:'updated',call:R.sanitizeCall(result)});ended++;}return ended;}
async function expireStaleCalls(date=new Date()){const ringing=await closeCalls({status:'ringing',ringExpiresAt:{$lte:date}},'ring-timeout');const accepted=await closeCalls({status:'accepted',acceptedAt:{$lte:new Date(date.getTime()-R.MAX_CALL_MS)}},'call-timeout');return {ringing,accepted};}
module.exports={createCall,transitionCall,getAuthorizedCall,ensureMediaEligibility,listCalls,closeCalls,expireStaleCalls,userActor};
