const express=require('express'),r=express.Router();const {z}=require('zod');const mongoose=require('mongoose');
const M=require('../../models');const {auth,roles}=require('../../core/auth');const {deviceAuth}=require('./auth');const D=require('./service');
const {asyncRoute,fail}=require('../../core/errors'),{parse}=require('../../core/validation');
const {events}=require('../calls/events');const C=require('../calls/service');
const mongoId=z.string().regex(/^[a-f\d]{24}$/i);
const deviceSchema=z.object({propertyId:mongoId,name:z.string().trim().min(2).max(120)}).strict();
const staff=express.Router();staff.use(auth,roles('owner','manager'));
staff.get('/',asyncRoute(async(req,res)=>res.json({data:(await M.Device.find({organizationId:req.actor.organizationId}).sort({createdAt:-1}).limit(250)).map(D.safeDevice)})));
staff.post('/',asyncRoute(async(req,res)=>{const b=parse(deviceSchema,req.body);const property=await M.Property.findOne({_id:b.propertyId,organizationId:req.actor.organizationId});if(!property)fail(404,'Property not found');const device=await M.Device.create({organizationId:req.actor.organizationId,propertyId:b.propertyId,name:b.name,status:'pending'});const credentials=await D.issuePairingCode(device);await M.AuditLog.create({organizationId:req.actor.organizationId,actorId:req.actor.id,event:'tablet.created',entityType:'Device',entityId:String(device.id)});res.set('Cache-Control','no-store').status(201).json({data:D.safeDevice(device),...credentials,warning:'Pairing code shown once. It expires in 10 minutes.'})}));
staff.post('/:id/pairing-code',asyncRoute(async(req,res)=>{D.validId(req.params.id);const device=await M.Device.findOne({_id:req.params.id,organizationId:req.actor.organizationId});if(!device)fail(404,'Device not found');const result=await D.issuePairingCode(device);events.emit('device.revoked',{organizationId:String(device.organizationId),deviceId:String(device.id)});await C.closeCalls({organizationId:device.organizationId,deviceId:device.id},'device-repairing');await M.AuditLog.create({organizationId:req.actor.organizationId,actorId:req.actor.id,event:'tablet.pairing.rotated',entityType:'Device',entityId:String(device.id)});res.set('Cache-Control','no-store').json({...result,warning:'Existing tablet credential revoked.'})}));
staff.patch('/:id',asyncRoute(async(req,res)=>{D.validId(req.params.id);const b=parse(z.object({name:z.string().trim().min(2).max(120).optional(),disabled:z.boolean().optional()}).strict().refine(x=>Object.keys(x).length>0),req.body);if(b.disabled===false)fail(400,'Use secure pairing to activate a device');
 const updates={$set:{}};if(b.name)updates.$set.name=b.name;
 if(b.disabled===true){updates.$set.status='disabled';updates.$unset={deviceKeyHash:1,pairingHash:1,pairingExpiresAt:1,credentialExpiresAt:1};}
 const device=await M.Device.findOneAndUpdate({_id:req.params.id,organizationId:req.actor.organizationId},updates,{new:true});if(!device)fail(404,'Device not found');
 if(b.disabled===true){events.emit('device.revoked',{organizationId:String(device.organizationId),deviceId:String(device.id)});await C.closeCalls({organizationId:device.organizationId,deviceId:device.id},'device-disabled');}
 await M.AuditLog.create({organizationId:req.actor.organizationId,actorId:req.actor.id,event:'tablet.updated',entityType:'Device',entityId:String(device.id),details:{disabled:b.disabled===true}});res.json({data:D.safeDevice(device)})}));
r.use('/devices',staff);
// Pairing uses a high-entropy code and is deliberately independent of owner/tenant access tokens.
const pairingRate=require('express-rate-limit')({windowMs:15*60_000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
r.post('/tablets/pair',pairingRate,asyncRoute(async(req,res)=>{const b=parse(z.object({deviceId:mongoId,pairingCode:z.string().min(48).max(128)}).strict(),req.body);const result=await D.pairTablet(b.deviceId,b.pairingCode);await M.AuditLog.create({organizationId:result.device.organizationId,event:'tablet.paired',entityType:'Device',entityId:result.device.id});res.set('Cache-Control','no-store').json(result)}));
const tablet=express.Router();tablet.use(deviceAuth);
tablet.get('/me',asyncRoute(async(req,res)=>{const device=await M.Device.findById(req.actor.id);res.json({data:D.safeDevice(device)})}));
tablet.get('/calls',asyncRoute(async(req,res)=>res.json({data:await C.listCalls(req.actor,req.query.limit)})));
tablet.post('/rotate-token',asyncRoute(async(req,res)=>{const result=await D.rotateTabletToken(req.actor);events.emit('device.revoked',{organizationId:req.actor.organizationId,deviceId:req.actor.id});await M.AuditLog.create({organizationId:req.actor.organizationId,event:'tablet.credential.rotated',entityType:'Device',entityId:req.actor.id});res.set('Cache-Control','no-store').json(result)}));
tablet.get('/calls/:id/ice',asyncRoute(async(req,res)=>{const call=await C.getAuthorizedCall(req.actor,req.params.id);if(!['ringing','accepted'].includes(call.status))fail(409,'Call no longer active');await C.ensureMediaEligibility(call);res.set('Cache-Control','no-store').json({data:require('../../core/ice-credentials').configuration({id:req.actor.id})})}));
for(const action of ['accept','reject','end','fail'])tablet.post(`/calls/:id/${action}`,asyncRoute(async(req,res)=>res.json({data:await C.transitionCall(req.actor,req.params.id,action)})));
r.use('/tablets',tablet);
module.exports=r;
