import {PortfolioProvider} from '@/features/property-management/store';
import {MaintenancePage} from '@/features/operations/ui';
export default function Page(){return <PortfolioProvider><MaintenancePage role="owner"/></PortfolioProvider>}
