require('dotenv').config();
const dns = require('node:dns');
try { dns.setServers(['1.1.1.1', '8.8.8.8']); } catch (_) {}
function config(){if(!process.env.MONGODB_URI)throw Error('MONGODB_URI required');if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32)throw Error('JWT_SECRET must be at least 32 characters');return {mongo:process.env.MONGODB_URI,secret:process.env.JWT_SECRET,port:Number(process.env.PORT||5000),origins:(process.env.CORS_ORIGINS||'http://localhost:3000').split(','),fileRoot:process.env.PRIVATE_FILE_ROOT||require('path').resolve(process.cwd(),'private-uploads'),workerEnabled:process.env.WORKER_ENABLED==='true'}}
module.exports={config};
