const r=require('express').Router(),{z}=require('zod');const M=require('../../models');const {auth,roles}=require('../../core/auth'),{parse}=require('../../core/validation'),{asyncRoute,fail}=require('../../core/errors');r.use(auth);
const models={deposits:[M.Deposit,z.object({tenancyId:z.string(),amountPaise:z.number().int().nonnegative()})],approvals:[M.Approval,z.object({kind:z.string(),payload:z.record(z.unknown())})],subscriptions:[M.Subscription,z.object({plan:z.string(),status:z.string(),roomLimit:z.number().int().nonnegative()})],cctv:[M.CctvShortcut,z.object({propertyId:z.string(),name:z.string(),url:z.string().url().refine(x=>x.startsWith('https://'))})]};
for(const [route,[Model,schema]] of Object.entries(models)){
 r.get('/'+route,roles('owner','manager'),asyncRoute(async(req,res)=>res.json({data:await Model.find({organizationId:req.actor.organizationId}).sort({createdAt:-1}).limit(250)})));
 r.post('/'+route,roles('owner','manager'),asyncRoute(async(req,res)=>{const b=parse(schema,req.body);res.status(201).json({data:await Model.create({...b,organizationId:req.actor.organizationId})})}));
}
module.exports=r;
