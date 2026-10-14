/** Dependency-free route/module smoke checks. Does not replace a production build. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let checks=0;
for(const route of ['owner/dashboard','owner/properties','owner/tenants','owner/enrollments','owner/tenancies','owner/invoices','owner/payments','owner/ledger','owner/maintenance','owner/notifications','owner/deposits','owner/documents','owner/reports','tenant/dashboard','tenant/enrollment','tenant/enrollment/status','tenant/invoices','tenant/payments','tenant/ledger','tenant/maintenance','tenant/notifications']){
 const file=path.join(root,'frontend/app',route,'page.tsx');assert.ok(fs.existsSync(file),`Missing ${route}`);
 assert.match(fs.readFileSync(file,'utf8'),/LIVE_MODE/,`Missing live-mode switch for ${route}`);checks++;
}
for(const module of ['auth','properties','enrollments','finance','maintenance','documents','files','notifications','calls','devices','catalog']){
 const file=path.join(root,'backend/src/modules',module,'routes.js');assert.ok(fs.existsSync(file));checks++;
}
const api=fs.readFileSync(path.join(root,'frontend/services/live/api.ts'),'utf8');assert.match(api,/Authorization/);assert.match(api,/refreshAccess/);assert.match(api,/sessionStorage/);checks+=3;
const server=fs.readFileSync(path.join(root,'backend/src/app.js'),'utf8');assert.match(server,/\/api\/catalog/);checks++;
const schema=fs.readFileSync(path.join(root,'backend/src/models/index.js'),'utf8');assert.match(schema,/acceptingEnrollments/);checks++;
const fsPath=path.join(root,'frontend');let parsed=0;
let typescript;
try{typescript=require('typescript')}catch{try{typescript=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}catch{typescript=null}}
if(typescript){function scan(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory()&&ent.name!=='node_modules')scan(p);else if(/\.(ts|tsx)$/.test(p)){const result=typescript.transpileModule(fs.readFileSync(p,'utf8'),{fileName:p,reportDiagnostics:true,compilerOptions:{target:typescript.ScriptTarget.ES2022,module:typescript.ModuleKind.ESNext,jsx:typescript.JsxEmit.Preserve}});const errs=(result.diagnostics||[]).filter(x=>x.category===typescript.DiagnosticCategory.Error);assert.equal(errs.length,0,`${p}: ${errs.map(x=>x.messageText).join(';')}`);parsed++}}}scan(fsPath)}
console.log(`B8 static checks: ${checks} passed. TypeScript syntax parsed: ${parsed} files${typescript?'':' (typescript not installed; skipped)'}.`);
