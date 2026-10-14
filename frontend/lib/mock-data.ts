export type UserRole = 'admin' | 'owner' | 'tenant';

export type DashboardStat = {
  label: string;
  value: string;
  change: string;
  tone: 'blue' | 'green' | 'amber' | 'red';
};

export type ActivityItem = {
  title: string;
  detail: string;
  time: string;
  tone: 'blue' | 'green' | 'amber' | 'slate';
};

export const roleMeta: Record<UserRole, { label: string; name: string; initials: string; workspace: string }> = {
  admin: { label: 'Platform admin', name: 'Ananya Sharma', initials: 'AS', workspace: 'RoomRent HQ' },
  owner: { label: 'Property owner', name: 'Arjun Mehta', initials: 'AM', workspace: 'Mehta Properties' },
  tenant: { label: 'Tenant', name: 'Riya Kapoor', initials: 'RK', workspace: 'Lakeview Residency' },
};

export const dashboardData: Record<UserRole, { eyebrow: string; title: string; description: string; stats: DashboardStat[]; activities: ActivityItem[] }> = {
  admin: {
    eyebrow: 'Wednesday, 14 October 2026',
    title: 'Good morning, Ananya',
    description: 'Here is what is happening across the RoomRent network today.',
    stats: [
      { label: 'Active properties', value: '248', change: '+12.4%', tone: 'blue' },
      { label: 'Registered owners', value: '184', change: '+8.2%', tone: 'green' },
      { label: 'Monthly rent volume', value: '₹82.4L', change: '+14.6%', tone: 'amber' },
      { label: 'Open approvals', value: '17', change: 'Needs attention', tone: 'red' },
    ],
    activities: [
      { title: 'New owner registration', detail: 'Priya Living Spaces · Mumbai', time: '12 min ago', tone: 'blue' },
      { title: 'Property approved', detail: 'Palm Grove Apartments · 42 rooms', time: '36 min ago', tone: 'green' },
      { title: 'Subscription renewed', detail: 'Urban Nest Properties · Pro plan', time: '1 hr ago', tone: 'amber' },
      { title: 'Support ticket escalated', detail: 'Payment verification · #RR-1048', time: '2 hrs ago', tone: 'slate' },
    ],
  },
  owner: {
    eyebrow: 'Wednesday, 14 October 2026',
    title: 'Good morning, Arjun',
    description: 'Your portfolio is steady. There are a few items waiting for your review.',
    stats: [
      { label: 'Properties', value: '4', change: '62 rooms total', tone: 'blue' },
      { label: 'Occupancy rate', value: '91.8%', change: '+3.4% this month', tone: 'green' },
      { label: 'Rent collected', value: '₹4.28L', change: '82% of expected', tone: 'amber' },
      { label: 'Pending actions', value: '6', change: '3 new today', tone: 'red' },
    ],
    activities: [
      { title: 'New enrollment request', detail: 'Riya Kapoor · Room 302, Lakeview', time: '18 min ago', tone: 'blue' },
      { title: 'Rent payment received', detail: 'Rahul Verma · ₹18,500 · UPI proof', time: '42 min ago', tone: 'green' },
      { title: 'Maintenance reported', detail: 'Leaking tap · Room 108, Palm Grove', time: '1 hr ago', tone: 'amber' },
      { title: 'Vacancy marked', detail: 'Room 204 · Lakeview Residency', time: '3 hrs ago', tone: 'slate' },
    ],
  },
  tenant: {
    eyebrow: 'Wednesday, 14 October 2026',
    title: 'Good morning, Riya',
    description: 'Your home at Lakeview Residency is up to date. Here is your monthly snapshot.',
    stats: [
      { label: 'Current rent', value: '₹18,500', change: 'Due 5 Nov 2026', tone: 'blue' },
      { label: 'Payment status', value: 'Paid', change: 'October rent cleared', tone: 'green' },
      { label: 'Room', value: '302', change: 'Lakeview Residency', tone: 'amber' },
      { label: 'Open requests', value: '1', change: 'Being reviewed', tone: 'red' },
    ],
    activities: [
      { title: 'Payment receipt available', detail: 'October 2026 rent · ₹18,500', time: 'Yesterday', tone: 'green' },
      { title: 'Maintenance update', detail: 'Corridor light replacement · In progress', time: '2 days ago', tone: 'amber' },
      { title: 'Lease document renewed', detail: 'Your updated agreement is ready', time: '5 days ago', tone: 'blue' },
      { title: 'Welcome to RoomRent', detail: 'Complete your profile to get started', time: '1 week ago', tone: 'slate' },
    ],
  },
};

export const formatINR = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
