const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');const {config}=require('../config');
function root(){return path.resolve(config().fileRoot)}
function location(key){if(!/^[a-f0-9]{32}$/.test(key))throw Error('Invalid storage key');return path.join(root(),key)}
async function write(buffer){const key=crypto.randomBytes(16).toString('hex');await fs.mkdir(root(),{recursive:true,mode:0o700});await fs.writeFile(location(key),buffer,{flag:'wx',mode:0o600});return key}
async function read(key){return fs.readFile(location(key))}
async function remove(key){await fs.rm(location(key),{force:true})}
module.exports={write,read,remove};
