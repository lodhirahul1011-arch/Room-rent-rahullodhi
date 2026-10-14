const r=require('express').Router();const {z}=require('zod');
const {auth}=require('../../core/auth');const {asyncRoute,fail}=require('../../core/errors');const {parse}=require('../../core/validation');const S=require('./service');
const rateLimit=require('express-rate-limit');const callLimiter=rateLimit({windowMs:60_000,limit:6,standardHeaders:'draft-7',legacyHeaders:false});
const mongoId=z.string().regex(/^[a-f\d]{24}$/i);const idempotency=z.string().trim().min(8).max(100).regex(/^[\w.:-]+$/);
const create=z.union([
 z.object({type:z.literal('tablet'),deviceId:mongoId,clientRequestId:idempotency}).strict(),
 z.object({type:z.literal('tenant'),recipientTenantId:mongoId.optional(),recipientOwnerId:mongoId.optional(),clientRequestId:idempotency}).strict().refine(b=>Boolean(b.recipientTenantId)!==Boolean(b.recipientOwnerId),'Specify exactly one target')
]);
r.use(auth);
r.post('/calls',callLimiter,asyncRoute(async(req,res)=>{const actor=S.userActor(req.actor),body=parse(create,req.body);const result=await S.createCall(actor,body);res.status(result.duplicate?200:201).json(result)}));
r.get('/calls',asyncRoute(async(req,res)=>res.json({data:await S.listCalls(S.userActor(req.actor),req.query.limit)})));
r.get('/calls/:id',asyncRoute(async(req,res)=>{const data=await S.getAuthorizedCall(S.userActor(req.actor),req.params.id);res.json({data:require('../../core/b7-rules').sanitizeCall(data)})}));
r.get('/calls/:id/ice',asyncRoute(async(req,res)=>{const call=await S.getAuthorizedCall(S.userActor(req.actor),req.params.id);if(!['ringing','accepted'].includes(call.status))fail(409,'Call no longer active');await S.ensureMediaEligibility(call);res.set('Cache-Control','no-store').json({data:require('../../core/ice-credentials').configuration({id:req.actor.id})})}));
for(const action of ['accept','reject','cancel','end','fail'])r.post(`/calls/:id/${action}`,asyncRoute(async(req,res)=>res.json({data:await S.transitionCall(S.userActor(req.actor),req.params.id,action)})));
module.exports=r;
