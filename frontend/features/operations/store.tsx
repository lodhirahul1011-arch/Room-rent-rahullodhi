'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {initialOperations,type Operations} from './engine';
const KEY='roomrent-phase6-operations-v1';
const Ctx=createContext<{data:Operations;ready:boolean;update:(fn:(s:Operations)=>Operations)=>void}|null>(null);
export function OperationsProvider({children}:{children:ReactNode}){const [data,setData]=useState<Operations>(initialOperations);const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw);if(Array.isArray(v.tickets)&&Array.isArray(v.notices)&&Array.isArray(v.documents)&&Array.isArray(v.deposits))setData(v)}}catch{}setReady(true)},[]);
 const update=(fn:(s:Operations)=>Operations)=>{const next=fn(data);setData(next);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}};
 return <Ctx.Provider value={{data,ready,update}}>{children}</Ctx.Provider>;
}
export function useOperations(){const x=useContext(Ctx);if(!x)throw Error('OperationsProvider missing');return x;}
