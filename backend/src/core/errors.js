class HttpError extends Error {constructor(status,message){super(message);this.status=status}}
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fail=(status,message)=>{throw new HttpError(status,message)};
module.exports={HttpError,asyncRoute,fail};
