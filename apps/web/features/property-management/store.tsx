'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createSeedPortfolio } from './seed';
import type { Portfolio } from './types';
const KEY='roomrent-phase3-portfolio-v1';
type Ctx = { portfolio: Portfolio; ready: boolean; update: (fn: (prev:Portfolio)=>Portfolio)=>void; reset:()=>void };
const Context = createContext<Ctx | null>(null);
export function PortfolioProvider({children}:{children:ReactNode}) {
  const [portfolio,setPortfolio]=useState<Portfolio>(createSeedPortfolio);
  const [ready,setReady]=useState(false);
  useEffect(()=>{try{const s=localStorage.getItem(KEY);if(s){const v=JSON.parse(s) as Portfolio;if(Array.isArray(v.properties)&&Array.isArray(v.floors)&&Array.isArray(v.rooms)&&Array.isArray(v.tenants)&&Array.isArray(v.tenancies))setPortfolio({...v,enrollments:Array.isArray(v.enrollments)?v.enrollments:[]})}}catch{}setReady(true)},[]);
  const update=(fn:(prev:Portfolio)=>Portfolio)=>setPortfolio(prev=>{const next=fn(prev);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next});
  const reset=()=>{const fresh=createSeedPortfolio();setPortfolio(fresh);try{localStorage.removeItem(KEY)}catch{}};
  return <Context.Provider value={{portfolio,ready,update,reset}}>{children}</Context.Provider>;
}
export function usePortfolio(){const ctx=useContext(Context);if(!ctx)throw new Error('PortfolioProvider missing');return ctx;}
