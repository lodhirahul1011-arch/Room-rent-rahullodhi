'use client';
import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {initialPlatform,type Platform} from './engine';
const KEY='roomrent-phase7-platform-v1';
const Context=createContext<{data:Platform;ready:boolean;update:(fn:(s:Platform)=>Platform)=>void}|null>(null);
export function PlatformProvider({children}:{children:ReactNode}){const [data,setData]=useState<Platform>(initialPlatform);const [ready,setReady]=useState(false);
useEffect(()=>{try{const raw=window.localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw) as Platform;if(Array.isArray(parsed.owners)&&Array.isArray(parsed.subscriptions)&&Array.isArray(parsed.approvals)&&Array.isArray(parsed.cctv)&&Array.isArray(parsed.tablets)&&Array.isArray(parsed.calls))setData(parsed)}}catch{}setReady(true)},[]);
const update=useCallback((fn:(s:Platform)=>Platform)=>{setData(prev=>{const next=fn(prev);try{window.localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next})},[]);
return <Context.Provider value={{data,ready,update}}>{children}</Context.Provider>}
export function usePlatform(){const v=useContext(Context);if(!v)throw Error('PlatformProvider missing');return v}
