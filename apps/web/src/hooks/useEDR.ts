import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { EDRAlert, PaginatedResponse } from '@/types/api';

interface EDRQueryParams {
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
  hostname?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useEDRAlerts(params: EDRQueryParams = {}) {
  return useQuery({
    queryKey: ['edr', 'alerts', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<EDRAlert>>('/edr/alerts', { params });
      return data;
    },
  });
}

export function useEDRStats() {
  return useQuery({
    queryKey: ['edr', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/edr/stats');
      return data;
    },
  });
}

export function useEDRPending(limit = 50) {
  return useQuery({
    queryKey: ['edr', 'pending', limit],
    queryFn: async () => {
      const { data } = await api.get('/edr/pending', { params: { limit } });
      return data;
    },
  });
}

export function useEDRTimeline() {
  return useQuery({
    queryKey: ['edr', 'timeline'],
    queryFn: async () => {
      const { data } = await api.get('/edr/timeline');
      return data;
    },
  });
}

export function useUpdateEDRStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/edr/alerts/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edr'] });
    },
  });
}
