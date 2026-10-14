import {describe,it,expect} from 'vitest';
import {initialPlatform,decideApproval,addCctv,addTablet,startCall,transitionCall,updateSubscription} from '@/features/platform/engine';
describe('Phase 7 mock platform engine',()=>{
 it('requires rejection reason',()=>expect(()=>decideApproval(initialPlatform,'ap1','rejected','', '2026-10-14')).toThrow());
 it('prevents repeat decision',()=>{const next=decideApproval(initialPlatform,'ap1','approved','','2026-10-14');expect(()=>decideApproval(next,'ap1','approved','','2026-10-14')).toThrow()});
 it('does not allow credentials or http CCTV URLs',()=>{const base={id:'c1',propertyId:'p1',name:'Gate',location:'Lobby',system:'Demo',url:'http://host/view'};expect(()=>addCctv(initialPlatform,base)).toThrow();expect(()=>addCctv(initialPlatform,{...base,url:'https://user:pass@host/view'})).toThrow()});
 it('accepts valid CCTV https link',()=>expect(addCctv(initialPlatform,{id:'c1',propertyId:'p1',name:'Gate',location:'Lobby',system:'Demo',url:'https://host/view'}).cctv).toHaveLength(1));
 it('rejects duplicate tablet codes',()=>{const t={id:'t1',propertyId:'p1',label:'Gate',code:'X123',status:'offline' as const,enabled:true};const s=addTablet(initialPlatform,t);expect(()=>addTablet(s,{...t,id:'t2',code:'x123'})).toThrow()});
 it('checks tablet registration before calls',()=>expect(()=>startCall(initialPlatform,{id:'c1',targetId:'unknown',targetType:'tablet',caller:'owner',status:'ringing',startedAt:'today'})).toThrow());
 it('rejects invalid call state jumps',()=>{const s=addTablet(initialPlatform,{id:'t1',propertyId:'p1',label:'Gate',code:'X123',status:'offline',enabled:true});const next=startCall(s,{id:'c1',targetId:'t1',targetType:'tablet',caller:'owner',status:'ringing',startedAt:'today'});expect(()=>transitionCall(next,'c1','ended','today')).not.toThrow();expect(()=>transitionCall(transitionCall(next,'c1','ended','today'),'c1','connected','today')).toThrow()});
 it('updates subscription limits',()=>expect(updateSubscription(initialPlatform,'sub1','Pro','active').subscriptions[0].propertyLimit).toBe(100));
});
