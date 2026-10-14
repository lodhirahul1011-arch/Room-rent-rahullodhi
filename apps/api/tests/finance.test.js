const test=require('node:test'),assert=require('node:assert/strict');const {validDate,invoiceKey,penaltyAmount,dateDiff}=require('../src/core/finance');
test('date validation rejects impossible date',()=>{assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-10-14'),true)});
test('invoice key stable and month verified',()=>{assert.equal(invoiceKey('ten-1','2026-10'),'ten-1:2026-10');assert.throws(()=>invoiceKey('ten-1','2026-13'))});
test('penalty waits through grace period',()=>{const rule={graceDays:15,mode:'fixed',value:25000};assert.equal(penaltyAmount(100000,15,rule),0);assert.equal(penaltyAmount(100000,16,rule),25000)});
test('percentage penalty uses basis points',()=>{assert.equal(penaltyAmount(100000,16,{graceDays:15,mode:'percentage',value:500}),5000)});
test('per day penalty only after grace',()=>{assert.equal(penaltyAmount(100000,18,{graceDays:15,mode:'per-day',value:1000}),3000)});
test('date difference stable UTC',()=>{assert.equal(dateDiff('2026-10-01','2026-10-17'),16)});
test('invalid rules rejected',()=>{assert.throws(()=>penaltyAmount(100000,16,{graceDays:-1,mode:'fixed',value:100}))});
