const r=require('express').Router();
const bcrypt=require('bcryptjs');const {z}=require('zod');const mongoose=require('mongoose');
const {User,Organization,Membership,AuthSession,AuditLog,Tenant}=require('../../models');
const {parse}=require('../../core/validation');const {asyncRoute,fail}=require('../../core/errors');
const {auth,roles}=require('../../core/auth');const {createSession,issueAccess,refreshHash,randomRefresh}=require('../../core/session');
const {PasswordResetToken}=require('../../models');
const {sendResendEmail}=require('../support/resend');
const crypto=require('node:crypto');
const credentials=z.object({email:z.string().email().transform(x=>x.trim().toLowerCase()),password:z.string().min(10)});
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
const viewMembership=m=>({organizationId:m.organizationId,role:m.role,tenantId:m.tenantId||null});
r.post('/register',asyncRoute(async(req,res)=>{
 const b=parse(credentials.extend({name:z.string().trim().min(2)}),req.body);
 const session=await mongoose.startSession();let user,org;
 try{await session.withTransaction(async()=>{
  if(await User.exists({email:b.email}).session(session))fail(409,'Email already exists');
  [user]=await User.create([{email:b.email,name:b.name,passwordHash:await bcrypt.hash(b.password,12),role:'owner'}],{session});
  [org]=await Organization.create([{name:`${b.name}'s Organization`,ownerId:user.id}],{session});
  await Membership.create([{userId:user.id,organizationId:org.id,role:'owner'}],{session});
 });}finally{await session.endSession()}
 res.status(201).json({user:publicUser(user),organizationId:org.id});
}));
r.post('/register-tenant',asyncRoute(async(req,res)=>{
 const b=parse(credentials.extend({name:z.string().trim().min(2)}),req.body);
 if(await User.exists({email:b.email}))fail(409,'Email already exists');
 const user=await User.create({email:b.email,name:b.name,passwordHash:await bcrypt.hash(b.password,12),role:'tenant'});
 res.status(201).json({user:publicUser(user)});
}));
r.post('/forgot-password',asyncRoute(async(req,res)=>{
 const b=parse(z.object({email:z.string().email().transform(x=>x.trim().toLowerCase())}),req.body);
 const {RESEND_API_KEY,RESEND_FROM_EMAIL}=process.env;
 if(!RESEND_API_KEY||!RESEND_FROM_EMAIL)fail(503,'Password recovery email is not configured. Contact the administrator.');
 const user=await User.findOne({email:b.email,active:true});
 if(user){
  await PasswordResetToken.deleteMany({userId:user.id,consumedAt:null});
  const token=crypto.randomBytes(32).toString('base64url');
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  await PasswordResetToken.create({userId:user.id,tokenHash,expiresAt:new Date(Date.now()+30*60*1000)});
  const configuredBase=process.env.FRONTEND_URL||(process.env.CORS_ORIGINS||'http://localhost:3000').split(',')[0];
  const base=configuredBase.replace(/\/$/,'');
  const resetUrl=`${base}/reset-password?token=${encodeURIComponent(token)}`;
  try{await sendResendEmail({from:RESEND_FROM_EMAIL,to:user.email,subject:'Reset your RoomRent password',text:`Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,html:`<p>We received a request to reset your RoomRent password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`})}
  catch(error){await PasswordResetToken.deleteOne({tokenHash});console.error('[Password reset email failed]:',error.message);fail(503,'Password reset email could not be sent. Check the mail configuration and try again.')}
 }
 res.json({message:'If an active account uses that email, a password reset link has been sent.'});
}));
r.post('/reset-password',asyncRoute(async(req,res)=>{
 const b=parse(z.object({token:z.string().min(32).max(256),newPassword:z.string().min(12).max(128)}),req.body);
 const tokenHash=crypto.createHash('sha256').update(b.token).digest('hex');
 const passwordHash=await bcrypt.hash(b.newPassword,12);const session=await mongoose.startSession();
 try{await session.withTransaction(async()=>{
  const reset=await PasswordResetToken.findOne({tokenHash,consumedAt:null,expiresAt:{$gt:new Date()}}).session(session);
  if(!reset)fail(400,'Reset link is invalid or expired. Request a new one.');
  reset.consumedAt=new Date();await reset.save({session});
  const user=await User.findOne({_id:reset.userId,active:true}).session(session);if(!user)fail(400,'Reset link is invalid or expired. Request a new one.');
  user.passwordHash=passwordHash;await user.save({session});
  await AuthSession.updateMany({userId:user.id,revokedAt:null},{$set:{revokedAt:new Date()}},{session});
 });}finally{await session.endSession()}
 res.json({message:'Password updated. Sign in with your new password.'});
}));
r.post('/login',asyncRoute(async(req,res)=>{
 const b=parse(credentials,req.body);
 const user=await User.findOne({email:b.email,active:true}).select('+passwordHash');
 if(!user||!await bcrypt.compare(b.password,user.passwordHash))fail(401,'Invalid credentials');
 const memberships=await Membership.find({userId:user.id,active:true});
 if(user.role!=='admin'&&memberships.length===0&&user.role!=='tenant')fail(403,'No active organization membership');
 const chosen=memberships[0];const role=user.role==='admin'?'admin':chosen?.role||'tenant';
 const tokens=await createSession(user,role,chosen?.organizationId||null);
 res.json({...tokens,user:publicUser(user),role,organizationId:chosen?.organizationId||null,memberships:memberships.map(viewMembership)});
}));
r.post('/refresh',asyncRoute(async(req,res)=>{
 const b=parse(z.object({refreshToken:z.string().min(32)}),req.body);const hash=refreshHash(b.refreshToken);
 const session=await AuthSession.findOne({refreshHash:hash,revokedAt:null,expiresAt:{$gt:new Date()}}).select('+refreshHash');
 if(!session)fail(401,'Invalid or expired refresh token');
 const user=await User.findById(session.userId);
 if(!user?.active)fail(401,'Account inactive');
 if(session.role==='admin'){if(user.role!=='admin')fail(403,'Admin role revoked')}
 else if(session.organizationId&&!await Membership.exists({userId:user.id,organizationId:session.organizationId,role:session.role,active:true}))fail(403,'Membership revoked');
 const nextToken=randomRefresh();
 const updated=await AuthSession.findOneAndUpdate({_id:session.id,refreshHash:hash,revokedAt:null},{$set:{refreshHash:refreshHash(nextToken),lastUsedAt:new Date()}},{new:true});
 if(!updated)fail(401,'Refresh token already used');
 res.json({accessToken:issueAccess(user,updated),refreshToken:nextToken,expiresInSeconds:900});
}));
r.use(auth);
r.get('/me',asyncRoute(async(req,res)=>{const user=await User.findById(req.actor.id);const memberships=await Membership.find({userId:req.actor.id,active:true});res.json({user:publicUser(user),actor:req.actor,memberships:memberships.map(viewMembership)})}));
r.post('/switch-organization',asyncRoute(async(req,res)=>{
 const b=parse(z.object({organizationId:z.string(),role:z.enum(['owner','manager','tenant'])}),req.body);
 if(!mongoose.isValidObjectId(b.organizationId))fail(400,'Invalid organization');
 const membership=await Membership.findOne({userId:req.actor.id,organizationId:b.organizationId,role:b.role,active:true});
 if(!membership)fail(403,'Membership missing');
 const user=await User.findById(req.actor.id);await AuthSession.updateOne({_id:req.actor.sessionId},{$set:{revokedAt:new Date()}});
 res.json({...await createSession(user,b.role,membership.organizationId),role:b.role,organizationId:b.organizationId});
}));
r.post('/logout',asyncRoute(async(req,res)=>{await AuthSession.updateOne({_id:req.actor.sessionId},{$set:{revokedAt:new Date()}});res.json({success:true})}));
r.post('/logout-all',asyncRoute(async(req,res)=>{await AuthSession.updateMany({userId:req.actor.id,revokedAt:null},{$set:{revokedAt:new Date()}});res.json({success:true})}));
r.get('/sessions',asyncRoute(async(req,res)=>{const sessions=await AuthSession.find({userId:req.actor.id,revokedAt:null,expiresAt:{$gt:new Date()}}).select('_id role organizationId createdAt lastUsedAt expiresAt');res.json({data:sessions})}));
r.post('/change-password',asyncRoute(async(req,res)=>{
 const b=parse(z.object({currentPassword:z.string(),newPassword:z.string().min(12).max(128)}),req.body);
 const user=await User.findById(req.actor.id).select('+passwordHash');if(!await bcrypt.compare(b.currentPassword,user.passwordHash))fail(401,'Current password incorrect');
 user.passwordHash=await bcrypt.hash(b.newPassword,12);await user.save();await AuthSession.updateMany({userId:user.id,revokedAt:null},{$set:{revokedAt:new Date()}});res.json({success:true,reauthenticationRequired:true});
}));
r.get('/memberships',roles('owner','manager'),asyncRoute(async(req,res)=>res.json({data:await Membership.find({organizationId:req.actor.organizationId}).select('userId organizationId role active tenantId')})));
r.post('/memberships',roles('owner'),asyncRoute(async(req,res)=>{
 const b=parse(z.object({email:z.string().email().transform(x=>x.toLowerCase()),role:z.enum(['manager','tenant']),tenantId:z.string().optional()}),req.body);
 const user=await User.findOne({email:b.email,active:true});if(!user)fail(404,'User must register first');
 if(b.role==='tenant'){
  if(!b.tenantId||!mongoose.isValidObjectId(b.tenantId))fail(400,'Linked tenant required');
  const tenant=await Tenant.findOne({_id:b.tenantId,organizationId:req.actor.organizationId});if(!tenant)fail(404,'Tenant not found');
  if(tenant.userId&&String(tenant.userId)!==String(user.id))fail(409,'Tenant belongs to another user');
  await Tenant.updateOne({_id:tenant.id,organizationId:req.actor.organizationId},{$set:{userId:user.id}});
 }
 const membership=await Membership.create({userId:user.id,organizationId:req.actor.organizationId,role:b.role,tenantId:b.role==='tenant'?b.tenantId:undefined});
 await AuditLog.create({organizationId:req.actor.organizationId,actorId:req.actor.id,event:'membership.created',entityType:'Membership',entityId:membership.id});
 res.status(201).json({data:membership});
}));
r.patch('/memberships/:id',roles('owner'),asyncRoute(async(req,res)=>{
 const b=parse(z.object({active:z.boolean()}),req.body);
 const target=await Membership.findOne({_id:req.params.id,organizationId:req.actor.organizationId});if(!target)fail(404,'Membership not found');
 if(target.role==='owner')fail(403,'Owner membership cannot be modified here');
 target.active=b.active;await target.save();
 if(!b.active)await AuthSession.updateMany({userId:target.userId,organizationId:target.organizationId,revokedAt:null},{$set:{revokedAt:new Date()}});
 await AuditLog.create({organizationId:req.actor.organizationId,actorId:req.actor.id,event:'membership.updated',entityType:'Membership',entityId:target.id,details:{active:b.active}});
 res.json({data:target});
}));
module.exports=r;
