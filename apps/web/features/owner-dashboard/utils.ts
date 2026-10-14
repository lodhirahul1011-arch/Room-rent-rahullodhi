import type { PropertyRecord, RentTrendRecord } from './types';

export function calculateOwnerSummary(properties: PropertyRecord[], trend: RentTrendRecord[]) {
  const current = trend[trend.length - 1];
  const totalRooms = properties.reduce((sum, property) => sum + property.rooms, 0);
  const occupiedRooms = properties.reduce((sum, property) => sum + property.occupiedRooms, 0);
  const expectedRent = properties.reduce((sum, property) => sum + property.expectedRent, 0);
  const collectedRent = properties.reduce((sum, property) => sum + property.collectedRent, 0);
  const pendingRent = current ? current.pending + current.overdue : 0;
  const overdueRent = current ? current.overdue : 0;

  return {
    totalProperties: properties.length,
    totalRooms,
    occupiedRooms,
    vacantRooms: totalRooms - occupiedRooms,
    activeTenants: occupiedRooms, // Demo assumption: one active tenant per occupied room.
    expectedRent,
    collectedRent,
    pendingRent,
    overdueRent,
    occupancyRate: totalRooms === 0 ? 0 : (occupiedRooms / totalRooms) * 100,
    collectionRate: expectedRent === 0 ? 0 : (collectedRent / expectedRent) * 100,
  };
}

export function formatINRCompact(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}K`;
  return `₹${value}`;
}
