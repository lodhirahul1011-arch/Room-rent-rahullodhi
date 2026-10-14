/** Dependency-light Phase 8 business-rule and route smoke checks.
 * Requires a TypeScript installation; no app runtime dependencies required.
 * Run: node tests/phase8-smoke.cjs
 */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const root = path.resolve(__dirname,'..');
let ts;
try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
require.extensions['.ts'] = (mod, filename) => { const src = fs.readFileSync(filename, 'utf8'); const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; mod._compile(js,filename); };
function load(relative) {
 const filename = path.join(root, relative);
 const src = fs.readFileSync(filename,'utf8');
 const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded = new Module(filename,module); loaded.filename=filename; loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(js,filename);return loaded.exports;
}
const finance=load('features/finance/engine.ts');
const property=load('features/property-management/logic.ts');
const operations=load('features/operations/engine.ts');
const platform=load('features/platform/engine.ts');
const today='2026-10-14';
const portfolio={properties:[{id:'pr1',name:'Home',location:'Bhopal',address:'Example',createdAt:today}],floors:[{id:'fl1',propertyId:'pr1',name:'G',order:0}],rooms:[{id:'r1',propertyId:'pr1',floorId:'fl1',number:'1',rentPaise:1000000,status:'active'}],tenants:[{id:'t1',name:'Tenant',phone:'123',email:'x@y.z',emergencyContact:'456',notes:''}],tenancies:[],enrollments:[]};
let checks=0;function check(name,fn){fn();checks++;process.stdout.write('PASS '+name+'\n');}
check('Reject impossible move-in calendar date',()=>assert.throws(()=>property.assignTenant(portfolio,'t1','r1','2026-02-30')));
const occupied=property.assignTenant(portfolio,'t1','r1','2026-01-01');
check('No double occupancy',()=>assert.throws(()=>property.assignTenant(occupied,'t1','r1',today)));
check('Reject impossible move-out calendar date',()=>assert.throws(()=>property.endTenancy(occupied,occupied.tenancies[0].id,'2026-02-30')));
const vacated=property.endTenancy(occupied,occupied.tenancies[0].id,'2026-03-01');
check('Preserve ended tenancy and vacancy',()=>{assert.equal(vacated.tenancies[0].status,'ended');assert.equal(property.roomStats(vacated).vacant,1)});
let f=finance.initialFinance();f=finance.createMonthlyInvoices(f,occupied,'2026-02');
check('Invoice created once per tenancy/month',()=>assert.equal(finance.createMonthlyInvoices(f,occupied,'2026-02').invoices.length,1));
check('No future invoice after move-out',()=>assert.equal(finance.createMonthlyInvoices(f,vacated,'2026-04').invoices.length,1));
const invoice=f.invoices[0];f=finance.submitPayment(f,invoice.id,250000,'cash','CASH-01');
check('Pending payment does not credit ledger',()=>assert.equal(finance.invoicePaid(f,invoice.id),0));
check('Prevent duplicate pending payment reference',()=>assert.throws(()=>finance.submitPayment(f,invoice.id,100000,'cash','cash-01')));
let approved=finance.decidePayment(f,f.payments[0].id,true);
check('Verified partial payment credited exactly once',()=>{assert.equal(finance.invoicePaid(approved,invoice.id),250000);assert.throws(()=>finance.decidePayment(approved,f.payments[0].id,true))});
check('Reject payment above remaining balance',()=>assert.throws(()=>finance.submitPayment(approved,invoice.id,900000,'cash','C-02')));
check('Grace period does not apply early penalty',()=>assert.equal(finance.penaltyForInvoice(approved,invoice,'2026-02-20'),0));
let penalized=finance.applyPenalty(approved,invoice.id,'2026-02-21');
check('Late penalty applied only once',()=>{assert.equal(penalized.penalties.length,1);assert.equal(finance.applyPenalty(penalized,invoice.id,'2026-02-25').penalties.length,1)});
check('Original invoice snapshot retained',()=>assert.deepEqual(penalized.invoices[0].originalItems,invoice.originalItems));
check('Ledger running balance matches invoice balance',()=>{const rows=finance.tenantLedger(penalized,'t1');assert.equal(rows.at(-1).balancePaise,finance.invoiceBalance(penalized,invoice))});
let op=operations.initialOperations();op=operations.createTicket(op,occupied,'t1','Leaking tap','Tap leaks heavily','plumbing');
check('Complaint linked to tenant room and property',()=>{assert.equal(op.tickets[0].roomId,'r1');assert.equal(op.tickets[0].propertyId,'pr1')});
check('Complaint cannot jump straight to resolved',()=>assert.throws(()=>operations.updateTicket(op,op.tickets[0].id,'resolved','Done')));
check('Tenant with ended tenancy cannot create new complaint',()=>assert.throws(()=>operations.createTicket(op,vacated,'t1','Leaking tap','Tap leaks heavily','plumbing')));
check('No deposit settlement before move-out',()=>{const d=operations.collectDeposit(operations.initialOperations(),occupied,occupied.tenancies[0].id,100000);assert.throws(()=>operations.settleDeposit(d,occupied,d.deposits[0].id,[]))});
check('Deposit deductions capped at collected deposit',()=>{const d=operations.collectDeposit(operations.initialOperations(),occupied,occupied.tenancies[0].id,100000);assert.throws(()=>operations.settleDeposit(d,vacated,d.deposits[0].id,[{reason:'damage',amountPaise:200000}]))});
check('CCTV rejects embedded credentials and plain HTTP',()=>{assert.throws(()=>platform.validateCctvUrl('https://user:pass@example.com'));assert.throws(()=>platform.validateCctvUrl('http://example.com'))});
check('Approval requires reason on rejection',()=>assert.throws(()=>platform.decideApproval(platform.initialPlatform,'ap1','rejected','',today)));
check('Duplicate approval action blocked',()=>{const p=platform.decideApproval(platform.initialPlatform,'ap1','approved','',today);assert.throws(()=>platform.decideApproval(p,'ap1','approved','',today))});
const mustExist=['/owner/dashboard','/owner/properties','/owner/tenants','/owner/enrollments','/owner/tenancies','/owner/invoices','/owner/payments','/owner/ledger','/owner/maintenance','/owner/deposits','/owner/cctv','/owner/devices','/owner/calls','/owner/approvals','/tenant/enrollment','/tenant/invoices','/tenant/payments','/tenant/ledger','/tenant/maintenance','/tenant/documents','/tenant/calls','/admin/owners','/admin/subscriptions','/admin/approvals','/admin/reports'];
check('All critical frontend route files present',()=>{for(const route of mustExist)assert.ok(fs.existsSync(path.join(root,'app',route.slice(1),'page.tsx')),route)});
let scanned=0;
for(const base of ['app','components','features','lib','services','tests']){
 const dir=path.join(root,base);if(!fs.existsSync(dir))continue;
 const scan=d=>{for(const ent of fs.readdirSync(d,{withFileTypes:true})){const file=path.join(d,ent.name);if(ent.isDirectory())scan(file);else if(/\.tsx?$/.test(ent.name)){const source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ent.name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0,`${file}: ${ast.parseDiagnostics.map(e=>e.messageText).join('; ')}`);scanned++;}}};scan(dir);
}
check(`TypeScript/TSX syntax valid for ${scanned} source files`,()=>assert.ok(scanned>120));
process.stdout.write(`\n${checks} Phase 8 smoke checks passed. No Next.js build/browser claim is made.\n`);
