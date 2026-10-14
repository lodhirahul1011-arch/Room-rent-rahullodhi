import { http, HttpResponse } from 'msw';
import { dashboardData } from '@/lib/mock-data';

export const handlers = [
  http.get('/api/mock/dashboard/:role', ({ params }) => {
    const role = params.role;
    if (role !== 'admin' && role !== 'owner' && role !== 'tenant') {
      return HttpResponse.json({ message: 'Unknown workspace' }, { status: 404 });
    }
    return HttpResponse.json(dashboardData[role]);
  }),
];
