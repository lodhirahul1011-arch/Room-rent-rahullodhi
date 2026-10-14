/**
 * Opt-in genuine HTTP + Socket.IO + MongoDB replica-set integration test.
 * Run only against a disposable database with `roomrent_b7_test` in its URI path:
 * B7_TEST_MONGO_URI=mongodb://localhost:27017/roomrent_b7_test?replicaSet=rs0 npm run test:integration
 * NEVER use production records. Requires npm install, a replica set, and socket.io-client.
 */
const test=require('node:test');const assert=require('node:assert/strict');
const uri=process.env.B7_TEST_MONGO_URI||'';
const permitted=/\/roomrent_b7_test(?:\?|$)/.test(uri);
test('B7 real HTTP, Socket.IO and MongoDB participant isolation', {skip:!permitted?'B7_TEST_MONGO_URI for disposable replica-set DB not configured':undefined,timeout:120000}, async()=>{
 process.env.MONGODB_URI=uri;
 process.env.JWT_SECRET='test-only-jwt-secret-with-sufficient-random-looking-length';
 process.env.CORS_ORIGINS='http://localhost:3000';
 const mongoose=require('mongoose');const http=require('node:http');const {io:connect}=require('socket.io-client');
 const M=require('../src/models');const app=require('../src/app');const {attachSignaling}=require('../src/modules/signaling/gateway');const {createSession}=require('../src/core/session');
 const server=http.createServer(app);let gateway;const sockets=[];
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 try{
  await M.CallLog.init();await M.CallParticipantLock.init();
  const [org,otherOrg]=await M.Organization.create([{name:'B7 Org'},{name:'B7 Other Org'}]);
  const [owner,tenant,manager,otherOwner]=await M.User.create([
   {name:'Owner',email:'b7.owner@example.test',passwordHash:'test-not-for-login',role:'owner'},
   {name:'Tenant',email:'b7.tenant@example.test',passwordHash:'test-not-for-login',role:'tenant'},
   {name:'Manager',email:'b7.manager@example.test',passwordHash:'test-not-for-login',role:'owner'},
   {name:'Other',email:'b7.other@example.test',passwordHash:'test-not-for-login',role:'owner'}
  ]);
  const property=await M.Property.create({organizationId:org.id,name:'B7 Test Building'});
  const floor=await M.Floor.create({organizationId:org.id,propertyId:property.id,name:'Ground',order:0});
  const room=await M.Room.create({organizationId:org.id,propertyId:property.id,floorId:floor.id,number:'1',rentPaise:100000});
  const tProfile=await M.Tenant.create({organizationId:org.id,userId:tenant.id,name:tenant.name});
  await M.Tenancy.create({organizationId:org.id,tenantId:tProfile.id,roomId:room.id,moveIn:'2026-01-01',status:'active'});
  await M.Membership.create([
   {organizationId:org.id,userId:owner.id,role:'owner'},
   {organizationId:org.id,userId:tenant.id,role:'tenant',tenantId:tProfile.id},
   {organizationId:org.id,userId:manager.id,role:'manager'},
   {organizationId:otherOrg.id,userId:otherOwner.id,role:'owner'}
  ]);
  const ownToken=(await createSession(owner,'owner',org.id)).accessToken;
  const tenantToken=(await createSession(tenant,'tenant',org.id)).accessToken;
  const managerToken=(await createSession(manager,'manager',org.id)).accessToken;
  const crossToken=(await createSession(otherOwner,'owner',otherOrg.id)).accessToken;
  gateway=attachSignaling(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const httpCall=async(method,path,token,body)=>{
   const response=await fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   return {status:response.status,body:response.status===204?null:await response.json()};
  };
  const socketOf=async(auth)=>{
   const socket=connect(base,{path:'/socket.io',auth,transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);
   await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Socket handshake timed out')),8000);socket.once('connect',()=>{clearTimeout(timeout);resolve()});socket.once('connect_error',e=>{clearTimeout(timeout);reject(e)})});return socket;
  };
  const ownerSocket=await socketOf({accessToken:ownToken});const tenantSocket=await socketOf({accessToken:tenantToken});
  const incoming=new Promise(resolve=>tenantSocket.once('call:incoming',resolve));
  const request={type:'tenant',recipientTenantId:String(tProfile.id),clientRequestId:'integration-owner-tenant-0001'};
  const created=await httpCall('POST','/api/calls',ownToken,request);assert.equal(created.status,201);
  assert.equal(created.body.data.status,'ringing');const callId=created.body.data.id;
  assert.equal((await incoming).id,callId);
  const busy=await httpCall('POST','/api/calls',managerToken,{type:'tenant',recipientTenantId:String(tProfile.id),clientRequestId:'integration-busy-check-0003'});assert.equal(busy.status,409);
  const replay=await httpCall('POST','/api/calls',ownToken,request);assert.equal(replay.status,200);assert.equal(replay.body.data.id,callId);
  assert.equal((await httpCall('GET',`/api/calls/${callId}`,managerToken)).status,403);
  assert.equal((await httpCall('GET',`/api/calls/${callId}`,crossToken)).status,404);
  const accept=await tenantSocket.emitWithAck('call:accept',{callId});assert.equal(accept.ok,true);assert.equal(accept.data.status,'accepted');
  const signalIncoming=new Promise(resolve=>tenantSocket.once('call:signal',resolve));
  const signal=await ownerSocket.emitWithAck('call:signal',{callId,kind:'offer',payload:{type:'offer',sdp:'v=0\r\ns=offer-data\r\n'}});
  assert.equal(signal.ok,true);assert.ok(signal.recipientSocketCount||signal.data?.recipientSocketCount);
  assert.equal((await signalIncoming).callId,callId);
  assert.equal((await httpCall('GET',`/api/calls/${callId}/ice`,tenantToken)).status,200);
  assert.equal((await httpCall('POST',`/api/calls/${callId}/end`,ownToken)).status,200);
  const createDevice=await httpCall('POST','/api/devices',ownToken,{name:'Lobby Tablet',propertyId:String(property.id)});
  assert.equal(createDevice.status,201);const deviceId=createDevice.body.data.id;
  const crossTablet=await httpCall('POST','/api/calls',crossToken,{type:'tablet',deviceId,clientRequestId:'cross-org-tablet-0004'});assert.equal(crossTablet.status,404);
  const paired=await httpCall('POST','/api/tablets/pair','ignored', {deviceId,pairingCode:createDevice.body.pairingCode});
  assert.equal(paired.status,200);const deviceToken=paired.body.deviceToken;
  const deviceSocket=await socketOf({deviceToken});const tabletIncoming=new Promise(resolve=>deviceSocket.once('call:incoming',resolve));
  const tabletCreated=await httpCall('POST','/api/calls',ownToken,{type:'tablet',deviceId,clientRequestId:'integration-owner-tablet-0002'});
  assert.equal(tabletCreated.status,201);assert.equal((await tabletIncoming).id,tabletCreated.body.data.id);
  const tabletAccepted=await deviceSocket.emitWithAck('call:accept',{callId:tabletCreated.body.data.id});assert.equal(tabletAccepted.ok,true);
  assert.equal((await httpCall('PATCH',`/api/devices/${deviceId}`,ownToken,{disabled:true})).status,200);
  assert.equal((await httpCall('GET','/api/tablets/me',deviceToken)).status,401);
  const disabled=await httpCall('POST','/api/calls',ownToken,{type:'tablet',deviceId,clientRequestId:'disabled-tablet-0005'});assert.equal(disabled.status,404);
 }finally{
   for(const socket of sockets)socket.disconnect();
   if(gateway)await gateway.close();
   if(server.listening)await new Promise(resolve=>server.close(resolve));
   // Explicitly dedicated disposable test database only.
   if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();
   await mongoose.disconnect();
 }
});
