require('dotenv').config();
const dns = require('node:dns');
try { dns.setServers(['1.1.1.1', '8.8.8.8']); } catch (_) {}
const defaultOrigins=['http://localhost:3000','http://127.0.0.1:3000','https://rent-frontend-a5qa.onrender.com'];
function config(){
 const mongoUri=process.env.MONGO_URI||process.env.MONGODB_URI;
 if(!mongoUri)throw Error('MONGO_URI or MONGODB_URI required');
 if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32)throw Error('JWT_SECRET must be at least 32 characters');
 const origins=[...new Set([...defaultOrigins,...(process.env.CORS_ORIGINS||'').split(',').map(origin=>origin.trim()).filter(Boolean)])];
 return {mongo:mongoUri,secret:process.env.JWT_SECRET,port:Number(process.env.PORT||5000),origins,fileRoot:process.env.PRIVATE_FILE_ROOT||require('path').resolve(process.cwd(),'private-uploads'),workerEnabled:process.env.WORKER_ENABLED==='true'}
}
module.exports={config};
