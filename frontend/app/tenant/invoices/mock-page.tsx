import {PortfolioProvider} from '@/features/property-management/store';
import {TenantFinancials} from '@/features/finance/ui';
export default function Page(){return <PortfolioProvider><TenantFinancials view="invoices"/></PortfolioProvider>}
