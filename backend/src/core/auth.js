const jwt=require('jsonwebtoken');
const {config}=require('../config');
const {User,Membership,AuthSession}=require('../models');
const {fail,asyncRoute}=require('./errors');
const {allowsRole,inOrganization}=require('./security-utils');
const {isValidObjectId}=require('mongoose');
async function resolveUserAccessToken(token){
 if(typeof token!=='string'||token.length>5000)fail(401,'Invalid access token');
 let payload;try{payload=jwt.verify(token,config().secret,{algorithms:['HS256'],issuer:'roomrent-api',audience:'roomrent-web'});}catch{fail(401,'Invalid or expired access token')}
 if(!isValidObjectId(payload.sub)||!isValidObjectId(payload.sid))fail(401,'Invalid access token');
 const [user,session]=await Promise.all([User.findById(payload.sub),AuthSession.findOne({_id:payload.sid,userId:payload.sub,revokedAt:null,expiresAt:{$gt:new Date()}})]);
 if(!user?.active||!session||session.role!==payload.role||String(session.organizationId||'')!==String(payload.organizationId||''))fail(401,'Session revoked or inactive');
 let membership=null;
 if(payload.role==='admin') {if(user.role!=='admin'||payload.organizationId)fail(403,'Invalid admin access')}
 else if(payload.role==='tenant'&&!payload.organizationId){if(user.role!=='tenant')fail(403,'Invalid tenant onboarding session')}
 else {membership=await Membership.findOne({userId:user.id,organizationId:payload.organizationId,role:payload.role,active:true});if(!membership)fail(403,'Organization membership revoked')}
 return {id:String(user.id),role:payload.role,organizationId:payload.organizationId||null,tenantId:membership?.tenantId?String(membership.tenantId):null,sessionId:String(session.id)};
}
const auth=asyncRoute(async(req,res,next)=>{
 const match=(req.headers.authorization||'').match(/^Bearer ([^\s]+)$/i);
 if(!match)fail(401,'Authentication required');
 req.actor=await resolveUserAccessToken(match[1]);next();
});
const roles=(...allowed)=>(req,res,next)=>allowsRole(req.actor?.role,allowed)?next():next(Object.assign(new Error('Forbidden'),{status:403}));
function scope(req,organizationId){if(!inOrganization(req.actor?.organizationId,organizationId))fail(403,'Organization access denied')}
module.exports={auth,roles,scope,resolveUserAccessToken};
