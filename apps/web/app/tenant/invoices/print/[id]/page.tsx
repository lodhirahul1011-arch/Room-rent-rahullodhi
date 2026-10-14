import {PortfolioProvider} from '@/features/property-management/store';
import {InvoicePrint} from '@/features/finance/invoice-print';
export default function Page({params}:{params:{id:string}}){return <PortfolioProvider><InvoicePrint id={params.id}/></PortfolioProvider>}
