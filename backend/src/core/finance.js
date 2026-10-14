const {fail}=require('./errors');
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(`${s}T00:00:00Z`))&&new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s;
const validMonth=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const safe=n=>Number.isSafeInteger(n)&&n>=0;
function penaltyAmount(outstanding,daysLate,rule){if(!safe(outstanding)||!Number.isInteger(daysLate)||daysLate<0)fail(400,'Invalid amounts');if(!Number.isInteger(rule.graceDays)||rule.graceDays<0||rule.graceDays>365)fail(400,'Invalid graceDays');if(!Number.isInteger(rule.value)||rule.value<=0)fail(400,'Invalid penalty value');if(daysLate<=rule.graceDays)return 0;switch(rule.mode){case 'fixed':return rule.value;case 'per-day':return rule.value*(daysLate-rule.graceDays);case 'percentage':if(rule.value>10000)fail(400,'Percentage over 100%');return Math.round(outstanding*rule.value/10000);default:fail(400,'Invalid penalty mode')}}
function dateDiff(a,b){if(!validDate(a)||!validDate(b))fail(400,'Invalid date');return Math.floor((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000)}
function invoiceKey(tenancyId,month){if(!validMonth(month))fail(400,'Invalid month');return `${tenancyId}:${month}`}
module.exports={validDate,validMonth,safe,penaltyAmount,dateDiff,invoiceKey};
