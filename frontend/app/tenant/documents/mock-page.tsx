import {PortfolioProvider} from '@/features/property-management/store';
import {DocumentsPage} from '@/features/operations/ui';
export default function Page(){return <PortfolioProvider><DocumentsPage role="tenant"/></PortfolioProvider>}
