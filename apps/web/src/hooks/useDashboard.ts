import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { DashboardData } from '@/types/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/dashboard');
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary');
      return data;
    },
    refetchInterval: 30000,
  });
}
