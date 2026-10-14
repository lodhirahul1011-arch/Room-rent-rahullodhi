import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import {FinanceProvider} from '@/features/finance/store';
import {OperationsProvider} from '@/features/operations/store';
import {PlatformProvider} from '@/features/platform/store';
import {PortfolioProvider} from '@/features/property-management/store';
import { QueryProvider } from '@/components/providers/query-provider';
import {LiveGuard} from '@/features/live/live-auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RoomRent · Rental operations, made clear',
  description: 'A focused workspace for property owners, tenants, and platform administrators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={inter.className}><QueryProvider><FinanceProvider><OperationsProvider><PlatformProvider><PortfolioProvider><LiveGuard>{children}</LiveGuard></PortfolioProvider></PlatformProvider></OperationsProvider></FinanceProvider></QueryProvider></body></html>;
}
