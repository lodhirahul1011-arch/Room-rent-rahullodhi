import { describe, expect, it } from 'vitest';
import { dashboardData, formatINR } from '@/lib/mock-data';
import { ownerProperties, ownerRentTrend, ownerQuickActions } from '@/features/owner-dashboard/data';
import { calculateOwnerSummary } from '@/features/owner-dashboard/utils';

describe('RoomRent mock data', () => {
  it('has a dashboard for every role', () => {
    expect(Object.keys(dashboardData)).toEqual(expect.arrayContaining(['admin', 'owner', 'tenant']));
  });

  it('formats Indian currency', () => {
    expect(formatINR(18500)).toContain('18,500');
  });

  it('calculates owner totals from the shared records', () => {
    const summary = calculateOwnerSummary(ownerProperties, ownerRentTrend);
    expect(summary.totalRooms).toBe(62);
    expect(summary.occupiedRooms).toBe(55);
    expect(summary.vacantRooms).toBe(7);
    expect(summary.activeTenants).toBe(summary.occupiedRooms);
    expect(summary.expectedRent).toBe(990000);
    expect(summary.collectedRent).toBe(898000);
    expect(summary.overdueRent).toBe(30000);
    expect(summary.pendingRent).toBe(92000);
  });

  it('keeps every quick action connected to a destination', () => {
    expect(ownerQuickActions.every((action) => action.status === 'coming-soon' || Boolean(action.href))).toBe(true);
  });
});
