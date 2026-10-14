const {EventEmitter}=require('node:events');
const events=new EventEmitter();events.setMaxListeners(20);
module.exports={events};
