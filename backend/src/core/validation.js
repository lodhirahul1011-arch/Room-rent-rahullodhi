const {fail}=require('./errors');
const parse=(schema,value)=>{const result=schema.safeParse(value);if(!result.success)fail(400,result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));return result.data};
const validMoney=n=>Number.isSafeInteger(n)&&n>=0;
module.exports={parse,validMoney};
