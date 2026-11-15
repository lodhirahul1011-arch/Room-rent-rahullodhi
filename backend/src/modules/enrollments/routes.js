const r=require('express').Router(),mongoose=require('mongoose');const {z}=require('zod');
const {Enrollment,Property,Room,Tenant,Tenancy,AuditLog,Membership,FileAsset,Notification}=require('../../models');
const {auth,roles}=require('../../core/auth');const {parse}=require('../../core/validation');
const {assertMoveIn,canSubmitEnrollment}=require('../../core/lifecycle');const {asyncRoute,fail}=require('../../core/errors');const multer=require('multer'),rules=require('../../core/b5-rules'),storage=require('../../core/private-storage');
const {notifyOrganizationRole,notifyTenant}=require('../../core/notifications');
const oid=mongoose.isValidObjectId;const objectId=z.string().refine(oid,'Invalid ID');
const form=z.object({applicantName:z.string().trim().min(2).max(150),phone:z.string().min(8).max(30),email:z.string().email(),emergencyContact:z.string().min(8).max(100),address:z.string().min(5).max(500),propertyId:objectId,roomId:objectId,moveIn:z.string(),documents:z.array(z.object({name:z.string().min(1).max(200),type:z.string().max(120),size:z.number().int().positive().max(10*1024*1024),category:z.enum(['identity','photo','other'])}).strict()).min(2).max(12)}).strict();
const enrollmentUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:2,fields:2}}).fields([{name:'identityDocument',maxCount:1},{name:'photograph',maxCount:1}]);
r.use(auth);
r.post('/',roles('tenant','owner','manager'),enrollmentUpload,asyncRoute(async(req,res)=>{
 const uploaded=req.files||{},identity=uploaded.identityDocument?.[0],photo=uploaded.photograph?.[0];let b;
 if(req.body.payload){let submitted;try{submitted=JSON.parse(req.body.payload)}catch{fail(400,'Invalid enrollment form data')}const values=parse(form.omit({documents:true}),submitted);if(!identity||!photo)fail(400,'Upload both an identity PDF and a photograph');if(identity.mimetype!=='application/pdf'||!rules.validUpload(identity.buffer,identity.mimetype))fail(400,'Identity document must be a valid PDF (max 10 MB)');if(!['image/jpeg','image/png'].includes(photo.mimetype)||!rules.validUpload(photo.buffer,photo.mimetype))fail(400,'Photograph must be a valid JPG or PNG image (max 10 MB)');b={...values,documents:[{name:rules.safeFilename(identity.originalname),type:identity.mimetype,size:identity.size,category:'identity'},{name:rules.safeFilename(photo.originalname),type:photo.mimetype,size:photo.size,category:'photo'}]}}
 else b=parse(form,req.body);
 assertMoveIn(b.moveIn);
 const [property,room]=await Promise.all([Property.findById(b.propertyId),Room.findById(b.roomId)]);
 if(!canSubmitEnrollment({property,room}))fail(404,'Property or room unavailable');
 if(!property.acceptingEnrollments)fail(409,'Property is not accepting enrollment requests');
 if(req.actor.role!=='tenant'&&String(property.organizationId)!==String(req.actor.organizationId))fail(403,'Property access denied');
 if(!b.documents.some(d=>d.category==='identity')||!b.documents.some(d=>d.category==='photo'))fail(400,'Identity and photo metadata required');
 if(req.actor.role==='tenant'&&await Enrollment.exists({applicantUserId:req.actor.id,status:'pending'}))fail(409,'You already have a pending enrollment');
 const existing=await Tenancy.exists({roomId:room.id,status:'active'});if(existing)fail(409,'Room occupied');
 const e=new Enrollment({...b,organizationId:property.organizationId,applicantUserId:req.actor.role==='tenant'?req.actor.id:undefined});const stored=[];
 try{if(identity&&photo){for(const [file,category] of [[identity,'identity'],[photo,'photo']]){const key=await storage.write(file.buffer,{mime:file.mimetype});stored.push(key);const asset=await FileAsset.create({organizationId:property.organizationId,ownerUserId:req.actor.id,relatedType:'enrollment',relatedId:String(e.id),kind:category,originalName:rules.safeFilename(file.originalname),mime:file.mimetype,size:file.size,sha256:rules.hash(file.buffer),storageKey:key,createdBy:req.actor.id});e.documents.find(d=>d.category===category).fileAssetId=asset.id}}await e.save()}catch(err){await FileAsset.deleteMany({storageKey:{$in:stored}});await Promise.all(stored.map(key=>storage.remove(key).catch(()=>{})));throw err}
 if(req.actor.role==='tenant')await notifyOrganizationRole(property.organizationId,['owner','manager'],{type:'enrollment',title:'New tenant application',body:`${e.applicantName} applied for room ${room.number}.`});
 res.status(201).json({data:e});
}));
r.post('/:id/documents',roles('tenant'),enrollmentUpload,asyncRoute(async(req,res)=>{
 if(!oid(req.params.id))fail(400,'Invalid enrollment ID');const identity=req.files?.identityDocument?.[0],photo=req.files?.photograph?.[0];if(!identity||!photo)fail(400,'Upload both an identity PDF and a photograph');
 if(identity.mimetype!=='application/pdf'||!rules.validUpload(identity.buffer,identity.mimetype))fail(400,'Identity document must be a valid PDF (max 10 MB)');if(!['image/jpeg','image/png'].includes(photo.mimetype)||!rules.validUpload(photo.buffer,photo.mimetype))fail(400,'Photograph must be a valid JPG or PNG image (max 10 MB)');
 const e=await Enrollment.findOne({_id:req.params.id,applicantUserId:req.actor.id});if(!e)fail(404,'Application not found');if(e.status!=='pending'&&!e.documentsReuploadRequested)fail(409,'The owner has not requested updated enrollment documents');
 const stored=[],created=[];const prior=e.documents.filter(d=>d.fileAssetId).map(d=>String(d.fileAssetId));
 try{const documents=[];for(const [file,category] of [[identity,'identity'],[photo,'photo']]){const key=await storage.write(file.buffer,{mime:file.mimetype});stored.push(key);const asset=await FileAsset.create({organizationId:e.organizationId,ownerUserId:req.actor.id,relatedType:'enrollment',relatedId:String(e.id),kind:category,originalName:rules.safeFilename(file.originalname),mime:file.mimetype,size:file.size,sha256:rules.hash(file.buffer),storageKey:key,createdBy:req.actor.id});created.push(asset.id);documents.push({name:asset.originalName,type:asset.mime,size:asset.size,category,fileAssetId:asset.id})}e.documents=[...e.documents.filter(d=>!['identity','photo'].includes(d.category)),...documents];e.documentsReuploadRequested=false;e.documentsReuploadReason='';await e.save()}catch(err){await FileAsset.deleteMany({_id:{$in:created}});await Promise.all(stored.map(key=>storage.remove(key).catch(()=>{})));throw err}
 if(prior.length){const oldAssets=await FileAsset.find({_id:{$in:prior}}).select('storageKey');await FileAsset.deleteMany({_id:{$in:prior}});await Promise.all(oldAssets.map(asset=>storage.remove(asset.storageKey).catch(()=>{})))}const room=await Room.findOne({_id:e.roomId,organizationId:e.organizationId}).select('number');await notifyOrganizationRole(e.organizationId,['owner','manager'],{type:'document',title:'Tenant documents updated',body:`${e.applicantName} uploaded updated application documents for room ${room?.number||'—'}.`});res.json({data:e});
}));
r.get('/mine',roles('tenant'),asyncRoute(async(req,res)=>res.json({data:await Enrollment.find({applicantUserId:req.actor.id}).sort({createdAt:-1}).limit(100)})));
r.get('/',roles('owner','manager'),asyncRoute(async(req,res)=>res.json({data:await Enrollment.find({organizationId:req.actor.organizationId}).sort({createdAt:-1}).limit(500)})));
r.post('/:id/documents/request',roles('owner','manager'),asyncRoute(async(req,res)=>{
 if(!oid(req.params.id))fail(400,'Invalid enrollment ID');
 const b=parse(z.object({reason:z.string().trim().min(4).max(500)}).strict(),req.body);
 const e=await Enrollment.findOneAndUpdate({_id:req.params.id,organizationId:req.actor.organizationId,applicantUserId:{$exists:true}},{$set:{documentsReuploadRequested:true,documentsReuploadReason:b.reason}},{new:true});
 if(!e)fail(404,'Linked tenant application not found');
 await AuditLog.create({organizationId:e.organizationId,actorId:req.actor.id,event:'enrollment.documents.reupload_requested',entityType:'Enrollment',entityId:String(e.id),details:{reason:b.reason}});
 if(e.applicantUserId)await Notification.create({organizationId:e.organizationId,userId:e.applicantUserId,type:'document',title:'Owner requested new documents',body:b.reason});
 res.json({data:{id:e.id,documentsReuploadRequested:true}});
}));
r.patch('/:id/documents/:category',roles('owner','manager'),asyncRoute(async(req,res)=>{
 if(!oid(req.params.id))fail(400,'Invalid enrollment ID');
 const b=parse(z.object({name:z.string().trim().min(1).max(200)}).strict(),req.body);
 const e=await Enrollment.findOne({_id:req.params.id,organizationId:req.actor.organizationId});if(!e)fail(404,'Application not found');
 const doc=e.documents.find(item=>item.category===req.params.category);if(!doc)fail(404,'Application document not found');
 doc.name=rules.safeFilename(b.name);await e.save();
 if(doc.fileAssetId)await FileAsset.updateOne({_id:doc.fileAssetId,organizationId:e.organizationId},{$set:{originalName:doc.name}});
 await AuditLog.create({organizationId:e.organizationId,actorId:req.actor.id,event:'enrollment.document.updated',entityType:'Enrollment',entityId:String(e.id),details:{category:doc.category,name:doc.name}});
 res.json({data:{id:e.id,name:doc.name}});
}));
r.delete('/:id/documents/:category',roles('owner','manager'),asyncRoute(async(req,res)=>{
 if(!oid(req.params.id))fail(400,'Invalid enrollment ID');
 const e=await Enrollment.findOne({_id:req.params.id,organizationId:req.actor.organizationId});if(!e)fail(404,'Application not found');
 const index=e.documents.findIndex(item=>item.category===req.params.category);if(index<0)fail(404,'Application document not found');
 const [doc]=e.documents.splice(index,1);e.documentsReuploadRequested=true;e.documentsReuploadReason='A document was removed by the owner. Please upload the identity PDF and photograph again.';await e.save();
 if(doc.fileAssetId){const asset=await FileAsset.findOne({_id:doc.fileAssetId,organizationId:e.organizationId});if(asset){await FileAsset.deleteOne({_id:asset.id});await storage.remove(asset.storageKey).catch(()=>{})}}
 await AuditLog.create({organizationId:e.organizationId,actorId:req.actor.id,event:'enrollment.document.deleted',entityType:'Enrollment',entityId:String(e.id),details:{category:doc.category}});
 res.status(204).end();
}));
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
