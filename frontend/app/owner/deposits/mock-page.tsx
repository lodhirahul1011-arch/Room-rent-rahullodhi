import {PortfolioProvider} from '@/features/property-management/store';
import {DepositsPage} from '@/features/operations/ui';
export default function Page(){return <PortfolioProvider><DepositsPage role="owner"/></PortfolioProvider>}
