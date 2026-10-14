'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {initialFinance,type FinanceState} from './engine';
const KEY='roomrent-phase5-finance-v1';
type ContextType={finance:FinanceState;ready:boolean;update:(updater:(state:FinanceState)=>FinanceState)=>void;reset:()=>void};
const FinanceContext=createContext<ContextType|null>(null);
export function FinanceProvider({children}:{children:ReactNode}){
 const [finance,setFinance]=useState<FinanceState>(initialFinance);const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const value=JSON.parse(raw) as FinanceState;if(Array.isArray(value.invoices)&&Array.isArray(value.payments)&&Array.isArray(value.penalties)&&Array.isArray(value.adjustments))setFinance({...value,meters:Array.isArray(value.meters)?value.meters:[]})}}catch{}setReady(true)},[]);
 const update=(updater:(state:FinanceState)=>FinanceState)=>setFinance(old=>{const next=updater(old);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next});
 const reset=()=>{setFinance(initialFinance());try{localStorage.removeItem(KEY)}catch{}};
 return <FinanceContext.Provider value={{finance,ready,update,reset}}>{children}</FinanceContext.Provider>;
}
export function useFinance(){const context=useContext(FinanceContext);if(!context)throw Error('FinanceProvider missing');return context;}
