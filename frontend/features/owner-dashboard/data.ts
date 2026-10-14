import type { OwnerActivity, PendingAction, PropertyRecord, QuickAction, RentTrendRecord } from './types';

export const ownerProperties: PropertyRecord[] = [
  { id: 'property-lakeview', name: 'Lakeview Residency', location: 'Koramangala, Bengaluru', rooms: 24, occupiedRooms: 22, expectedRent: 418000, collectedRent: 394500 },
  { id: 'property-palm', name: 'Palm Grove Apartments', location: 'Andheri West, Mumbai', rooms: 18, occupiedRooms: 16, expectedRent: 286000, collectedRent: 246000 },
  { id: 'property-terrace', name: 'The Terrace House', location: 'Hitech City, Hyderabad', rooms: 12, occupiedRooms: 10, expectedRent: 178000, collectedRent: 159500 },
  { id: 'property-park', name: 'Parkside Homes', location: 'Salt Lake, Kolkata', rooms: 8, occupiedRooms: 7, expectedRent: 108000, collectedRent: 98000 },
];

export const ownerRentTrend: RentTrendRecord[] = [
  { month: 'May', expected: 920000, collected: 842000, pending: 52000, overdue: 26000 },
  { month: 'Jun', expected: 944000, collected: 878500, pending: 43000, overdue: 22500 },
  { month: 'Jul', expected: 966000, collected: 901000, pending: 41000, overdue: 24000 },
  { month: 'Aug', expected: 974000, collected: 915500, pending: 38500, overdue: 20000 },
  { month: 'Sep', expected: 986000, collected: 898000, pending: 57000, overdue: 31000 },
  { month: 'Oct', expected: 990000, collected: 898000, pending: 62000, overdue: 30000 },
];

export const ownerPendingActions: PendingAction[] = [
  { id: 'enrollment-riya', title: 'Tenant enrollment requests', detail: 'Riya Kapoor · Lakeview Residency', count: 2, tone: 'blue', href: '/owner/enrollments', status: 'action' },
  { id: 'payment-verification', title: 'Payment proofs to verify', detail: '3 UPI screenshots awaiting review', amount: 55500, tone: 'amber', href: '/owner/payments', status: 'action' },
  { id: 'overdue-invoices', title: 'Overdue rent invoices', detail: 'Follow up before penalty processing', amount: 30000, tone: 'red', href: '/owner/invoices', status: 'action' },
  { id: 'maintenance-complaints', title: 'Maintenance complaints', detail: '2 open requests across your properties', count: 2, tone: 'slate', href: '/owner/maintenance', status: 'action' },
  { id: 'approval-queue', title: 'Approval queue', detail: 'Sensitive rent and tenancy changes', count: 1, tone: 'blue', href: '/owner/approvals', status: 'action' },
];

export const ownerActivities: OwnerActivity[] = [
  { id: 'activity-enrollment', title: 'New tenant enrollment', detail: 'Riya Kapoor · Room 302, Lakeview Residency', timestamp: '18 min ago', tone: 'blue' },
  { id: 'activity-proof', title: 'Payment proof submitted', detail: 'Rahul Verma · ₹18,500 · UPI proof', timestamp: '42 min ago', tone: 'amber' },
  { id: 'activity-verified', title: 'Payment verified', detail: 'October rent · Room 201, Palm Grove', timestamp: '1 hr ago', tone: 'green' },
  { id: 'activity-invoice', title: 'Invoice generated', detail: 'November rent cycle · 55 occupied rooms', timestamp: '2 hrs ago', tone: 'blue' },
  { id: 'activity-vacated', title: 'Room marked vacant', detail: 'Room 204 · Lakeview Residency', timestamp: '3 hrs ago', tone: 'slate' },
  { id: 'activity-maintenance', title: 'Maintenance complaint received', detail: 'Leaking tap · Room 108, Palm Grove', timestamp: 'Yesterday', tone: 'amber' },
];

export const ownerQuickActions: QuickAction[] = [
  { label: 'Add property', detail: 'Create a new property record', icon: 'property', href: '/owner/properties', status: 'available' },
  { label: 'Add room', detail: 'Add a room to your portfolio', icon: 'room', href: '/owner/rooms', status: 'coming-soon' },
  { label: 'Register tenant', detail: 'Start a new enrollment', icon: 'tenant', href: '/owner/enrollments', status: 'coming-soon' },
  { label: 'Generate invoice', detail: 'Prepare the next rent cycle', icon: 'invoice', href: '/owner/invoices', status: 'coming-soon' },
  { label: 'Record payment', detail: 'Enter an offline payment', icon: 'payment', href: '/owner/payments', status: 'coming-soon' },
  { label: 'View ledger', detail: 'Review your financial history', icon: 'ledger', href: '/owner/ledger', status: 'coming-soon' },
];
