const {asyncRoute,fail}=require('../../core/errors');
const {resolveDeviceToken}=require('./service');
const deviceAuth=asyncRoute(async(req,res,next)=>{const match=(req.headers.authorization||'').match(/^Bearer ([^\s]+)$/i);if(!match)fail(401,'Tablet device token required');const device=await resolveDeviceToken(match[1]);if(!device)fail(401,'Tablet token expired or revoked');req.actor=device;next();});
module.exports={deviceAuth};
