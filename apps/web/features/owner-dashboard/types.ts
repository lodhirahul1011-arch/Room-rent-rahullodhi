export type PropertyRecord = {
  id: string;
  name: string;
  location: string;
  rooms: number;
  occupiedRooms: number;
  expectedRent: number;
  collectedRent: number;
};

export type RentTrendRecord = {
  month: string;
  expected: number;
  collected: number;
  pending: number;
  overdue: number;
};

export type PendingAction = {
  id: string;
  title: string;
  detail: string;
  amount?: number;
  count?: number;
  tone: 'blue' | 'amber' | 'red' | 'slate';
  href?: string;
  status: 'action' | 'unavailable';
};

export type OwnerActivity = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: 'blue' | 'green' | 'amber' | 'slate';
};

export type QuickAction = {
  label: string;
  detail: string;
  icon: 'property' | 'room' | 'tenant' | 'invoice' | 'payment' | 'ledger';
  href?: string;
  status: 'available' | 'coming-soon';
};
