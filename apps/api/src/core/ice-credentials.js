const crypto=require('node:crypto');
// coturn --use-auth-secret style time-limited credentials; TURN_SHARED_SECRET never leaves the server.
function buildIceServers({actorId,stunUrls='',turnUrls='',turnSecret='',ttlSeconds=7200,now=Date.now()}){
 const servers=[];
 const stun=stunUrls.split(',').map(s=>s.trim()).filter(Boolean);
 const turn=turnUrls.split(',').map(s=>s.trim()).filter(Boolean);
 if(stun.length&&stun.some(s=>!/^stuns?:[^\s]+$/i.test(s)))throw Error('Invalid STUN URL configuration');
 if(turn.length&&turn.some(s=>!/^turns?:[^\s]+$/i.test(s)))throw Error('Invalid TURN URL configuration');
 if(stun.length)servers.push({urls:stun});
 if(turn.length){
  if(!turnSecret||turnSecret.length<32)throw Error('TURN_SHARED_SECRET must be set and strong');
  const expiration=Math.floor(now/1000)+ttlSeconds;
  const username=`${expiration}:${String(actorId).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)}`;
  const credential=crypto.createHmac('sha1',turnSecret).update(username).digest('base64');
  servers.push({urls:turn,username,credential,credentialType:'password'});
 }
 return {iceServers:servers,iceTransportPolicy:'all',credentialsExpireAt:turn.length?new Date((Math.floor(now/1000)+ttlSeconds)*1000).toISOString():null};
}
const configuration=(actor)=>buildIceServers({actorId:actor.id,stunUrls:process.env.WEBRTC_STUN_URLS||'',turnUrls:process.env.WEBRTC_TURN_URLS||'',turnSecret:process.env.TURN_SHARED_SECRET||'',ttlSeconds:7200});
module.exports={buildIceServers,configuration};
