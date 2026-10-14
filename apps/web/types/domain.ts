import type { UserRole } from '@/lib/mock-data';

export type Session = {
  userId: string;
  role: UserRole;
  displayName: string;
};

export type MockResponse<T> = {
  data: T;
  status: number;
};
