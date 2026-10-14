import { PortfolioProvider } from '@/features/property-management/store';
import { OwnerDashboard } from '@/features/owner-dashboard';

export default function OwnerDashboardPage() {
  return <PortfolioProvider><OwnerDashboard /></PortfolioProvider>;
}
