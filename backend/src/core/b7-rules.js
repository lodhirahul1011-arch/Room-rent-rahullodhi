const crypto = require('node:crypto');
const RING_MS = 45_000;
const MAX_CALL_MS = 2 * 60 * 60_000;
const DEVICE_TOKEN_MS = 30 * 24 * 60 * 60_000;
const PAIRING_MS = 10 * 60_000;
const TERMINAL = new Set(['rejected','cancelled','ended','missed','failed']);
const TRANSITIONS = Object.freeze({
  ringing: {accept:'accepted',reject:'rejected',cancel:'cancelled',timeout:'missed',fail:'failed'},
  accepted: {end:'ended',timeout:'ended',fail:'failed'},
  rejected:{},cancelled:{},ended:{},missed:{},failed:{}
});
const hash = input => crypto.createHash('sha256').update(input).digest('hex');
const newSecret = () => crypto.randomBytes(48).toString('base64url');
function transition(status, action){return TRANSITIONS[status]?.[action] || null;}
function mayAct(call, actor, action){
  if(!call||!actor||String(call.organizationId)!==String(actor.organizationId))return false;
  const caller = actor.kind==='user'&&String(call.callerId)===String(actor.id);
  const recipient = actor.kind==='device'
    ? Boolean(call.deviceId)&&String(call.deviceId)===String(actor.id)
    : actor.kind==='user'&&Boolean(call.recipientId)&&String(call.recipientId)===String(actor.id);
  if(action==='accept'||action==='reject')return recipient;
  if(action==='cancel')return caller;
  if(action==='end')return caller||recipient;
  return caller||recipient;
}
function participantKeys(organizationId,callerId,recipient){
  const org=String(organizationId);
  const keys=[`${org}:user:${callerId}`,`${org}:${recipient.kind}:${recipient.id}`];
  return [...new Set(keys)].sort();
}
function safeSignal(type,payload){
  if(!['offer','answer','ice-candidate'].includes(type)||!payload||typeof payload!=='object'||Array.isArray(payload))return null;
  if(type==='ice-candidate'){
    const {candidate,sdpMid,sdpMLineIndex,usernameFragment}=payload;
    if(typeof candidate!=='string'||candidate.length>8192|| (sdpMid!==undefined&&(typeof sdpMid!=='string'||sdpMid.length>128)) || (sdpMLineIndex!==undefined&&(!Number.isInteger(sdpMLineIndex)||sdpMLineIndex<0||sdpMLineIndex>65535))|| (usernameFragment!==undefined&&(typeof usernameFragment!=='string'||usernameFragment.length>256)))return null;
    return {candidate,sdpMid:sdpMid??null,sdpMLineIndex:sdpMLineIndex??null,usernameFragment:usernameFragment??null};
  }
  if(payload.type!==type||typeof payload.sdp!=='string'||payload.sdp.length<10||payload.sdp.length>65_536)return null;
  return {type,sdp:payload.sdp};
}
function signalingAllowed(call,actor,type){
  if(!mayAct(call,actor,'signal')||call.status!=='accepted')return false;
  const caller=actor.kind==='user'&&String(call.callerId)===String(actor.id);
  return type==='offer'?caller:type==='answer'?!caller:true;
}
function sanitizeCall(call){const c=typeof call.toObject==='function'?call.toObject():call;return {id:String(c._id||c.id),type:c.type,status:c.status,organizationId:String(c.organizationId),propertyId:String(c.propertyId),callerId:String(c.callerId),recipientId:c.recipientId?String(c.recipientId):null,deviceId:c.deviceId?String(c.deviceId):null,tenantId:c.tenantId?String(c.tenantId):null,createdAt:c.createdAt,ringExpiresAt:c.ringExpiresAt,acceptedAt:c.acceptedAt||null,endedAt:c.endedAt||null,endedReason:c.endedReason||null};}
module.exports={RING_MS,MAX_CALL_MS,DEVICE_TOKEN_MS,PAIRING_MS,TERMINAL,hash,newSecret,transition,mayAct,participantKeys,safeSignal,signalingAllowed,sanitizeCall};
