const {Server}=require('socket.io');
const {config}=require('../../config');
const {resolveUserAccessToken}=require('../../core/auth');
const {resolveDeviceToken}=require('../devices/service');
const {getAuthorizedCall,ensureMediaEligibility,transitionCall,listCalls}=require('../calls/service');
const {events}=require('../calls/events');
const R=require('../../core/b7-rules');
const roomUser=(org,id)=>`org:${org}:user:${id}`;
const roomDevice=(org,id)=>`org:${org}:device:${id}`;
const actorRoom=actor=>actor.kind==='device'?roomDevice(actor.organizationId,actor.id):roomUser(actor.organizationId,actor.id);
const peerRoom=(call,actor)=>{
 const caller=actor.kind==='user'&&String(call.callerId)===String(actor.id);
 if(caller)return call.type==='tablet'?roomDevice(call.organizationId,call.deviceId):roomUser(call.organizationId,call.recipientId);
 return roomUser(call.organizationId,call.callerId);
};
function attachSignaling(httpServer){
 const io=new Server(httpServer,{path:'/socket.io',maxHttpBufferSize:72_000,transports:['websocket','polling'],cors:{origin:config().origins,methods:['GET','POST'],credentials:false},allowRequest:(req,cb)=>cb(null,!req.headers.origin||config().origins.includes(req.headers.origin))});
 const resolve=async(credential)=>credential.kind==='device'?resolveDeviceToken(credential.token):
   resolveUserAccessToken(credential.token).then(actor=>({...actor,kind:'user'}));
 io.use(async(socket,next)=>{
   try{const a=socket.handshake.auth||{};
     const credential=(typeof a.accessToken==='string'&&a.accessToken)?{kind:'user',token:a.accessToken}:
       (typeof a.deviceToken==='string'&&a.deviceToken)?{kind:'device',token:a.deviceToken}:null;
     if(!credential)throw Error('Authentication required');
     const actor=await resolve(credential);
     if(!actor?.organizationId||actor.role==='admin')throw Error('Active organization access required');
     socket.data.credential=credential;socket.data.actor=actor;next();
   }catch{next(new Error('Socket authentication failed'))}
 });
 // Re-check auth before each delivery to prevent revoked sessions from receiving calls.
 async function deliver(room,event,payload){
   let delivered=0;const sockets=await io.in(room).fetchSockets();
   for(const socket of sockets){try{
     const current=await resolve(socket.data.credential);
     if(!current||actorRoom(current)!==room){socket.disconnect(true);continue;}
     socket.emit(event,payload);delivered++;
   }catch{socket.disconnect(true)}}
   return delivered;
 }
 const onChanged=({kind,call})=>{
   const callerRoom=roomUser(call.organizationId,call.callerId);
   const recipientRoom=call.type==='tablet'?roomDevice(call.organizationId,call.deviceId):roomUser(call.organizationId,call.recipientId);
   if(kind==='incoming')void deliver(recipientRoom,'call:incoming',call);
   else {void deliver(callerRoom,'call:updated',call);void deliver(recipientRoom,'call:updated',call)}
 };
 const onRevoked=({organizationId,deviceId})=>io.in(roomDevice(organizationId,deviceId)).disconnectSockets(true);
 events.on('call.changed',onChanged);events.on('device.revoked',onRevoked);
 io.on('connection',async(socket)=>{
   const actor=socket.data.actor;
   socket.join(actorRoom(actor));
   try{const calls=await listCalls(actor,25);socket.emit('call:sync',calls.filter(c=>['ringing','accepted'].includes(c.status)))}catch{}
   let windowStart=Date.now(),count=0;
   const limited=()=>{if(Date.now()-windowStart>60_000){windowStart=Date.now();count=0;}return ++count>120};
   async function execute(fn,ack){const callback=typeof ack==='function'?ack:()=>{};if(limited())return callback({ok:false,code:'RATE_LIMITED'});
     try{const refreshed=await resolve(socket.data.credential);if(!refreshed||actorRoom(refreshed)!==actorRoom(actor)){socket.disconnect(true);return callback({ok:false,code:'AUTH_REVOKED'})}
       const data=await fn(refreshed);callback({ok:true,data});}
     catch(error){callback({ok:false,code:error.status===403?'FORBIDDEN':error.status===404?'NOT_FOUND':error.status===409?'CONFLICT':'INVALID_EVENT'});}
   }
   for(const action of ['accept','reject','cancel','end','fail']){
     socket.on(`call:${action}`,(payload,ack)=>execute(async(a)=>{
       if(!payload||typeof payload.callId!=='string')throw Error('callId required');
       return transitionCall(a,payload.callId,action);
     },ack));
   }
   socket.on('call:signal',(message,ack)=>execute(async(a)=>{
     if(!message||typeof message.callId!=='string'||!['offer','answer','ice-candidate'].includes(message.kind))throw Error('Invalid signal');
     const payload=R.safeSignal(message.kind,message.payload);if(!payload)throw Error('Invalid WebRTC payload');
     const call=await getAuthorizedCall(a,message.callId);
     await ensureMediaEligibility(call);
     if(!R.signalingAllowed(call,a,message.kind))throw Object.assign(new Error('Signaling denied'),{status:403});
     const recipientSocketCount=await deliver(peerRoom(call,a),'call:signal',{callId:String(call.id),kind:message.kind,payload,from:a.kind});
     return {delivered:recipientSocketCount>0,recipientSocketCount};
   },ack));
 });
 io.engine.on('connection_error',()=>{});
 const close=async()=>{events.off('call.changed',onChanged);events.off('device.revoked',onRevoked);await new Promise(resolve=>io.close(resolve))};
 return {io,close};
}
module.exports={attachSignaling,roomUser,roomDevice,actorRoom,peerRoom};
