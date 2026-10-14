const crypto=require('node:crypto');
const refreshHash=token=>crypto.createHash('sha256').update(token).digest('hex');
const randomRefresh=()=>crypto.randomBytes(48).toString('base64url');
const allowsRole=(actual,allowed)=>allowed.includes(actual);
const inOrganization=(actorOrg,targetOrg)=>Boolean(actorOrg)&&String(actorOrg)===String(targetOrg);
module.exports={refreshHash,randomRefresh,allowsRole,inOrganization};
