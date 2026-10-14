import { dashboardData, type UserRole } from '@/lib/mock-data';
import { mockRequest } from '@/services/api-client';
import type { MockResponse } from '@/types/domain';

export function getDashboard(role: UserRole): Promise<MockResponse<typeof dashboardData[UserRole]>> {
  return mockRequest(dashboardData[role]);
}

// Phase 2 owner dashboard endpoint contract. The same shape can be served by Express later.
import { ownerActivities, ownerPendingActions, ownerProperties, ownerQuickActions, ownerRentTrend } from '@/features/owner-dashboard/data';

export const getOwnerDashboard = () => mockRequest({
  properties: ownerProperties,
  rentTrend: ownerRentTrend,
  pendingActions: ownerPendingActions,
  activities: ownerActivities,
  quickActions: ownerQuickActions,
}, 220);
