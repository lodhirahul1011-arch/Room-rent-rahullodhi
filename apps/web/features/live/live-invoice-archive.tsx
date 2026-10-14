'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {downloadPrivateFile,idOf,json,request,unwrap} from '@/services/live/api';

type Invoice = {_id?:string;id?:string;month:string;dueDate:string;originalItems:Array<{kind:string;label:string;amountPaise:number}>};
type Revision = {_id?:string;id?:string;revision:number;kind:string;description:string;totalPaise:number;items:Array<{kind:string;label:string;amountPaise:number}>};
type Archive = {_id?:string;id?:string;revision:number;fileAssetId:string};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n/100);

/** Live invoice history deliberately bypasses browser-only mock invoice printing. */
export function LiveInvoiceArchive({invoiceId}:{invoiceId:string}) {
  const [invoice,setInvoice]=useState<Invoice|null>(null);
  const [revisions,setRevisions]=useState<Revision[]>([]);
  const [archives,setArchives]=useState<Archive[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<number|null>(null);

  useEffect(()=>{let active=true;
    (async()=>{
      try {
        // No unscoped invoice-detail route exists; use the authorized list endpoint.
        const [invoices,history,files]=await Promise.all([
          unwrap(request<Invoice[]>('/api/invoices')),
          unwrap(request<Revision[]>(`/api/invoices/${encodeURIComponent(invoiceId)}/revisions`)),
          unwrap(request<Archive[]>(`/api/invoices/${encodeURIComponent(invoiceId)}/pdfs`))
        ]);
        if(!active)return;
        const found = invoices.find((x: Invoice) => idOf(x) === invoiceId);
        if(!found)throw new Error('Invoice is not available for this account');
        setInvoice(found);setRevisions(history);setArchives(files);
      } catch(e){if(active)setError(e instanceof Error?e.message:'Could not load invoice history')}
    })();
    return()=>{active=false};
  },[invoiceId]);

  async function archivePDF(revision:number){
    setBusy(revision);setError('');
    try{
      const existing=archives.find(x=>x.revision===revision);
      const file=existing||await unwrap<Archive>(request<Archive>(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf?revision=${revision}`,json('POST',{})));
      if(!existing&&file)setArchives(prev=>[...prev,file]);
      if(file?.fileAssetId)await downloadPrivateFile(String(file.fileAssetId),`roomrent-invoice-v${revision}.pdf`);
    }catch(e){setError(e instanceof Error?e.message:'PDF archive failed')}
    finally{setBusy(null)}
  }

  return <main className="mx-auto max-w-4xl space-y-5 p-6 text-slate-900">
    <Link href="/owner/invoices" className="text-sm text-teal-700 underline">← Back to invoices</Link>
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold">Invoice revisions and PDF archive</h1>
      <p className="mt-1 text-sm text-slate-600">Live MongoDB records — original invoice and every later financial revision remain separate.</p>
      {invoice&&<p className="mt-3">Period: <strong>{invoice.month}</strong> · Due date: <strong>{invoice.dueDate}</strong></p>}
      {error&&<p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
    {revisions.length===0&&!error&&<p className="text-sm text-slate-500">Loading revisions…</p>}
    {revisions.map(revision=><section key={revision.revision} className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Revision {revision.revision} · {revision.kind}</h2><p className="text-sm text-slate-600">{revision.description}</p></div><button type="button" disabled={busy!==null} onClick={()=>void archivePDF(revision.revision)} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy===revision.revision?'Preparing…':archives.some(x=>x.revision===revision.revision)?'Download archived PDF':'Archive and download PDF'}</button></div>
      <ul className="mt-4 divide-y text-sm">{revision.items.map((item,i)=><li key={i} className="flex justify-between gap-4 py-2"><span>{item.label}</span><span className="tabular-nums">{money(item.amountPaise)}</span></li>)}</ul>
      <p className="mt-3 border-t pt-3 text-right font-semibold">Total: {money(revision.totalPaise)}</p>
    </section>)}
  </main>;
}
