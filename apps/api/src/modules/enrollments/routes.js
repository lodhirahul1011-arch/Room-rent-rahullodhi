const r=require('express').Router(),mongoose=require('mongoose');const {z}=require('zod');
const {Enrollment,Property,Room,Tenant,Tenancy,AuditLog,Membership}=require('../../models');
const {auth,roles}=require('../../core/auth');const {parse}=require('../../core/validation');
const {assertMoveIn,canSubmitEnrollment}=require('../../core/lifecycle');const {asyncRoute,fail}=require('../../core/errors');
const oid=mongoose.isValidObjectId;const objectId=z.string().refine(oid,'Invalid ID');
const form=z.object({applicantName:z.string().trim().min(2).max(150),phone:z.string().min(8).max(30),email:z.string().email(),emergencyContact:z.string().min(8).max(100),address:z.string().min(5).max(500),propertyId:objectId,roomId:objectId,moveIn:z.string(),documents:z.array(z.object({name:z.string().min(1).max(200),type:z.string().max(120),size:z.number().int().positive().max(10*1024*1024),category:z.enum(['identity','photo','other'])}).strict()).min(2).max(12)}).strict();
r.use(auth);
r.post('/',roles('tenant','owner','manager'),asyncRoute(async(req,res)=>{
 const b=parse(form,req.body);assertMoveIn(b.moveIn);
 const [property,room]=await Promise.all([Property.findById(b.propertyId),Room.findById(b.roomId)]);
 if(!canSubmitEnrollment({property,room}))fail(404,'Property or room unavailable');
 if(!property.acceptingEnrollments)fail(409,'Property is not accepting enrollment requests');
 if(req.actor.role!=='tenant'&&String(property.organizationId)!==String(req.actor.organizationId))fail(403,'Property access denied');
 if(!b.documents.some(d=>d.category==='identity')||!b.documents.some(d=>d.category==='photo'))fail(400,'Identity and photo metadata required');
 if(req.actor.role==='tenant'&&await Enrollment.exists({applicantUserId:req.actor.id,status:'pending'}))fail(409,'You already have a pending enrollment');
 const existing=await Tenancy.exists({roomId:room.id,status:'active'});if(existing)fail(409,'Room occupied');
 const e=await Enrollment.create({...b,organizationId:property.organizationId,applicantUserId:req.actor.role==='tenant'?req.actor.id:undefined});res.status(201).json({data:e});
}));
r.get('/mine',roles('tenant'),asyncRoute(async(req,res)=>res.json({data:await Enrollment.find({applicantUserId:req.actor.id}).select('-documents').sort({createdAt:-1}).limit(100)})));
r.get('/',roles('owner','manager'),asyncRoute(async(req,res)=>res.json({data:await Enrollment.find({organizationId:req.actor.organizationId}).sort({createdAt:-1}).limit(500)})));
r.post('/:id/reject',roles('owner','manager'),asyncRoute(async(req,res)=>{
 if(!oid(req.params.id))fail(400,'Invalid ID');const b=parse(z.object({reason:z.string().trim().min(4).max(1000)}).strict(),req.body);
 const doc=await Enrollment.findOneAndUpdate({_id:req.params.id,organizationId:req.actor.organizationId,status:'pending'},{$set:{status:'rejected',rejectionReason:b.reason,decisionAt:new Date()}},{new:true});if(!doc)fail(409,'Request missing or already decided');
 await AuditLog.create({organizationId:doc.organizationId,actorId:req.actor.id,event:'enrollment.rejected',entityType:'Enrollment',entityId:String(doc.id),details:{reason:b.reason}});
 res.json({data:doc});
}));
r.post('/:id/approve',roles('owner','manager'),asyncRoute(async(req,res)=>{
 if(!oid(req.params.id))fail(400,'Invalid ID');const session=await mongoose.startSession();try{let response;
 await session.withTransaction(async()=>{
 const e=await Enrollment.findOne({_id:req.params.id,organizationId:req.actor.organizationId,status:'pending'}).session(session);if(!e)fail(409,'Request already decided');
 const [property,room]=await Promise.all([Property.findOne({_id:e.propertyId,organizationId:e.organizationId}).session(session),Room.findOne({_id:e.roomId,organizationId:e.organizationId}).session(session)]);
 if(!canSubmitEnrollment({property,room}))fail(409,'Room no longer available');
 if(await Tenancy.exists({roomId:room.id,status:'active'}).session(session))fail(409,'Room already occupied');
 let tenant;if(e.applicantUserId){tenant=await Tenant.findOne({userId:e.applicantUserId,organizationId:e.organizationId}).session(session);if(tenant&&await Tenancy.exists({tenantId:tenant._id,status:'active'}).session(session))fail(409,'Applicant already has an active tenancy')}
 if(!tenant)[tenant]=await Tenant.create([{organizationId:e.organizationId,name:e.applicantName,phone:e.phone,email:e.email,emergencyContact:e.emergencyContact,userId:e.applicantUserId||undefined}],{session});
 if(await Tenancy.exists({tenantId:tenant.id,status:'active'}).session(session))fail(409,'Tenant already has an active tenancy');
 const [tenancy]=await Tenancy.create([{organizationId:e.organizationId,tenantId:tenant.id,roomId:room.id,moveIn:e.moveIn,status:'active'}],{session});
 if(e.applicantUserId){const prior=await Membership.findOne({userId:e.applicantUserId,organizationId:e.organizationId}).session(session);if(prior&&prior.role!=='tenant')fail(409,'Existing organization role is not tenant');await Membership.updateOne({userId:e.applicantUserId,organizationId:e.organizationId},{$set:{role:'tenant',active:true,tenantId:tenant.id},$setOnInsert:{userId:e.applicantUserId,organizationId:e.organizationId}},{upsert:true,session})}
 e.status='approved';e.decisionAt=new Date();e.approvedTenantId=tenant.id;e.approvedTenancyId=tenancy.id;await e.save({session});
 await AuditLog.create([{organizationId:e.organizationId,actorId:req.actor.id,event:'enrollment.approved',entityType:'Enrollment',entityId:String(e.id),details:{tenantId:String(tenant.id),tenancyId:String(tenancy.id)}}],{session});response={enrollment:e,tenant,tenancy};
 });res.json({data:response});
 }finally{await session.endSession()}
}));
module.exports=r;
