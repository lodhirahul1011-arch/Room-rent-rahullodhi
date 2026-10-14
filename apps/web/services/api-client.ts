import type { MockResponse } from '@/types/domain';

export async function mockRequest<T>(data: T, delay = 450): Promise<MockResponse<T>> {
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  return { data, status: 200 };
}
