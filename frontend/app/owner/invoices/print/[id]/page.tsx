import {LIVE_MODE} from '@/services/live/api';
import {LiveInvoiceArchive} from '@/features/live/live-invoice-archive';
import {PortfolioProvider} from '@/features/property-management/store';
import {InvoicePrint} from '@/features/finance/invoice-print';
export default function Page({params}:{params:{id:string}}){
  return LIVE_MODE?<LiveInvoiceArchive invoiceId={params.id}/>:<PortfolioProvider><InvoicePrint id={params.id}/></PortfolioProvider>;
}
