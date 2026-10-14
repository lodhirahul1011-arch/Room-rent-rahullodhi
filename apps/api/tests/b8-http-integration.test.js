/**
 * B8 end-to-end HTTP/MongoDB integration: NOT run against production databases.
 * Requires a dedicated single-node Mongo replica set database named roomrent_b8_test.
 * B8_TEST_MONGO_URI='mongodb://localhost:27017/roomrent_b8_test?replicaSet=rs0&directConnection=true' npm run test:b8
 * No WebRTC/media or concurrent calling tests are included by design.
 */
const test=require('node:test');const assert=require('node:assert/strict');
const uri=process.env.B8_TEST_MONGO_URI||'';
const allowed=/\/roomrent_b8_test(?:\?|$)/.test(uri)&&!/(mongodb\+srv|\.mongodb\.net)/.test(uri);
test('B8 complete HTTP: tenant enrollment, isolation, billing, partial payment, ledger and vacancy',{skip:!allowed?'B8_TEST_MONGO_URI must point to local disposable roomrent_b8_test replica-set DB':undefined,timeout:150000},async()=>{
 process.env.MONGODB_URI=uri;process.env.JWT_SECRET='b8-integration-test-only-key-longer-than-32-chars';process.env.CORS_ORIGINS='http://localhost:3000';
 const mongoose=require('mongoose');const M=require('../src/models');const app=require('../src/app');
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const server=app.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{if(server.listening)resolve();else{server.once('listening',resolve);server.once('error',reject)}});
 const base=`http://127.0.0.1:${server.address().port}`;
 async function call(method,path,token,body){const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});let content=null;try{content=await response.json()}catch{}return {status:response.status,body:content};}
 async function owner(email){const created=await call('POST','/api/auth/register',null,{name:'B8 Owner',email,password:'testPassword1234!'});assert.equal(created.status,201,JSON.stringify(created.body));const login=await call('POST','/api/auth/login',null,{email,password:'testPassword1234!'});assert.equal(login.status,200);return login.body.accessToken;}
 try{
  await mongoose.connection.dropDatabase();
  for(const model of [M.User,M.Organization,M.Membership,M.Tenancy,M.Room,M.Property,M.Floor,M.Enrollment,M.Invoice,M.Payment,M.LedgerEntry,M.PaymentAllocation])await model.init();
  const ownerA=await owner('b8-owner-a@example.test'),ownerB=await owner('b8-owner-b@example.test');
  const p=await call('POST','/api/properties',ownerA,{name:'B8 Test Property',location:'Test district',address:'Test lane',acceptingEnrollments:true});assert.equal(p.status,201,JSON.stringify(p.body));const propertyId=p.body.data._id;
  const forbiddenProperty=await call('GET',`/api/properties/${propertyId}`,ownerB);assert.equal(forbiddenProperty.status,404);
  const floor=await call('POST','/api/floors',ownerA,{propertyId,name:'Ground',order:0});assert.equal(floor.status,201,JSON.stringify(floor.body));
  const room=await call('POST','/api/rooms',ownerA,{propertyId,floorId:floor.body.data._id,number:'B8-01',rentPaise:1500000,status:'active'});assert.equal(room.status,201,JSON.stringify(room.body));const roomId=room.body.data._id;
  const reg=await call('POST','/api/auth/register-tenant',null,{name:'B8 Tenant',email:'b8-tenant@example.test',password:'testPassword1234!'});assert.equal(reg.status,201);
  const before=await call('POST','/api/auth/login',null,{email:'b8-tenant@example.test',password:'testPassword1234!'});assert.equal(before.status,200);const onboardingToken=before.body.accessToken;
  const catalog=await call('GET','/api/catalog/properties',onboardingToken);assert.equal(catalog.status,200);assert.ok(catalog.body.data.some(x=>x.id===propertyId));
  assert.equal((await call('GET','/api/properties',onboardingToken)).status,403);
  const month=new Date().toISOString().slice(0,7),moveIn=month+'-01';
  const enrollment=await call('POST','/api/enrollments',onboardingToken,{applicantName:'B8 Tenant',phone:'9876543210',email:'b8-tenant@example.test',emergencyContact:'9876543211',address:'Test address India',propertyId,roomId,moveIn,documents:[{name:'identity.pdf',type:'application/pdf',size:2048,category:'identity'},{name:'photo.jpg',type:'image/jpeg',size:1024,category:'photo'}]});assert.equal(enrollment.status,201,JSON.stringify(enrollment.body));
  const eId=enrollment.body.data._id;
  const crossApproval=await call('POST',`/api/enrollments/${eId}/approve`,ownerB,{});assert.notEqual(crossApproval.status,200);
  const approved=await call('POST',`/api/enrollments/${eId}/approve`,ownerA,{});assert.equal(approved.status,200,JSON.stringify(approved.body));
  const duplicate=await call('POST',`/api/enrollments/${eId}/approve`,ownerA,{});assert.notEqual(duplicate.status,200);
  const tenantLogin=await call('POST','/api/auth/login',null,{email:'b8-tenant@example.test',password:'testPassword1234!'});assert.equal(tenantLogin.status,200);const tenantToken=tenantLogin.body.accessToken;
  const ownTenancies=await call('GET','/api/tenant/tenancies',tenantToken);assert.equal(ownTenancies.status,200);assert.equal(ownTenancies.body.data.length,1);
  const generation=await call('POST','/api/invoices/generate',ownerA,{month,dueDay:5});assert.equal(generation.status,201,JSON.stringify(generation.body));assert.equal(generation.body.data.length,1);const invoiceId=generation.body.data[0]._id;
  const rerun=await call('POST','/api/invoices/generate',ownerA,{month,dueDay:5});assert.equal(rerun.status,201);assert.equal(rerun.body.data.length,0);
  const invoices=await call('GET','/api/invoices',tenantToken);assert.equal(invoices.status,200);assert.equal(invoices.body.data.length,1);
  const payment=await call('POST','/api/payments',tenantToken,{invoiceId,amountPaise:400000,method:'upi',reference:'TEST-B8-1111',proof:{name:'payment.png',size:800,type:'image/png'}});assert.equal(payment.status,201,JSON.stringify(payment.body));
  const beforeVerify=await call('GET','/api/tenant/ledger',tenantToken);assert.equal(beforeVerify.status,200);assert.equal(beforeVerify.body.data.filter(x=>x.creditPaise>0).length,0);
  const verified=await call('POST',`/api/payments/${payment.body.data._id}/verify`,ownerA,{});assert.equal(verified.status,200,JSON.stringify(verified.body));
  const verifyAgain=await call('POST',`/api/payments/${payment.body.data._id}/verify`,ownerA,{});assert.notEqual(verifyAgain.status,200);
  const balance=await call('GET',`/api/invoices/${invoiceId}/balance`,tenantToken);assert.equal(balance.status,200);assert.equal(balance.body.data.balancePaise,1100000);
  const ledger=await call('GET','/api/tenant/ledger',tenantToken);assert.equal(ledger.status,200);assert.equal(ledger.body.data.filter(x=>x.creditPaise===400000).length,1);
  const crossInvoice=await call('GET',`/api/invoices/${invoiceId}/balance`,ownerB);assert.equal(crossInvoice.status,404);
  const ended=await call('POST',`/api/tenancies/${approved.body.data.tenancy._id}/move-out`,ownerA,{moveOut:month+'-20'});assert.equal(ended.status,200,JSON.stringify(ended.body));
  const rooms=await call('GET','/api/rooms',ownerA);assert.equal(rooms.status,200);assert.equal(rooms.body.data.find(x=>x._id===roomId).occupancy,'vacant');
 }finally{await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();await mongoose.disconnect()}
});
