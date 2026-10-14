const test=require('node:test');const assert=require('node:assert/strict');
const {refreshHash,randomRefresh,allowsRole,inOrganization}=require('../src/core/security-utils');
test('refresh tokens are unique and hashes are not raw',()=>{const a=randomRefresh(),b=randomRefresh();assert.notEqual(a,b);assert.ok(a.length>=60);assert.equal(refreshHash(a).length,64);assert.notEqual(refreshHash(a),a)});
test('tenant cannot perform owner action',()=>assert.equal(allowsRole('tenant',['owner','manager']),false));
test('owner and manager can perform permitted actions',()=>{assert.equal(allowsRole('owner',['owner','manager']),true);assert.equal(allowsRole('manager',['owner','manager']),true)});
test('another organization is denied',()=>assert.equal(inOrganization('org-a','org-b'),false));
test('unscoped admin cannot access organization',()=>assert.equal(inOrganization(null,'org-a'),false));
test('same organization is allowed',()=>assert.equal(inOrganization('org-a','org-a'),true));
