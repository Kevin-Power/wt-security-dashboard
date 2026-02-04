import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { HIBPBreach, PaginatedResponse } from '@/types/api';

interface HIBPQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  domain?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useHIBPBreaches(params: HIBPQueryParams = {}) {
  return useQuery({
    queryKey: ['hibp', 'breaches', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<HIBPBreach>>('/hibp/breaches', { params });
      return data;
    },
  });
}

export function useHIBPStats() {
  return useQuery({
    queryKey: ['hibp', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/hibp/stats');
      return data;
    },
  });
}

export function useHIBPPending(limit = 50) {
  return useQuery({
    queryKey: ['hibp', 'pending', limit],
    queryFn: async () => {
      const { data } = await api.get('/hibp/pending', { params: { limit } });
      return data;
    },
  });
}

export function useUpdateHIBPStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/hibp/breaches/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hibp'] });
    },
  });
}
