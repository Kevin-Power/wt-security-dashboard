import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { NCMDevice, PaginatedResponse } from '@/types/api';

interface NCMQueryParams {
  page?: number;
  limit?: number;
  priority?: string;
  hwModel?: string;
  minCvss?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useNCMDevices(params: NCMQueryParams = {}) {
  return useQuery({
    queryKey: ['ncm', 'devices', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<NCMDevice>>('/ncm/devices', { params });
      return data;
    },
  });
}

export function useNCMStats() {
  return useQuery({
    queryKey: ['ncm', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/ncm/stats');
      return data;
    },
  });
}

export function useNCMByPriority() {
  return useQuery({
    queryKey: ['ncm', 'by-priority'],
    queryFn: async () => {
      const { data } = await api.get('/ncm/by-priority');
      return data;
    },
  });
}

export function useNCMCritical(limit = 50) {
  return useQuery({
    queryKey: ['ncm', 'critical', limit],
    queryFn: async () => {
      const { data } = await api.get('/ncm/critical', { params: { limit } });
      return data;
    },
  });
}
