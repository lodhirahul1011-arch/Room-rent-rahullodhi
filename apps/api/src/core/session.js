const {refreshHash,randomRefresh}=require('./security-utils');
const jwt=require('jsonwebtoken');const {config}=require('../config');
const {AuthSession}=require('../models');
const issueAccess=(user,session)=>jwt.sign({sub:String(user.id),sid:String(session.id),role:session.role,organizationId:session.organizationId?String(session.organizationId):null},config().secret,{algorithm:'HS256',issuer:'roomrent-api',audience:'roomrent-web',expiresIn:'15m'});
async function createSession(user,role,organizationId){const refreshToken=randomRefresh();const session=await AuthSession.create({userId:user.id,role,organizationId:organizationId||null,refreshHash:refreshHash(refreshToken),expiresAt:new Date(Date.now()+7*86400000)});return {accessToken:issueAccess(user,session),refreshToken,expiresInSeconds:900,sessionId:session.id}}
module.exports={createSession,issueAccess,refreshHash,randomRefresh};
