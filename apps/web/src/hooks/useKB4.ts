import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { KB4User, PaginatedResponse } from '@/types/api';

interface KB4QueryParams {
  page?: number;
  limit?: number;
  department?: string;
  status?: string;
  minRiskScore?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useKB4Users(params: KB4QueryParams = {}) {
  return useQuery({
    queryKey: ['kb4', 'users', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<KB4User>>('/kb4/users', { params });
      return data;
    },
  });
}

export function useKB4Stats() {
  return useQuery({
    queryKey: ['kb4', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/kb4/stats');
      return data;
    },
  });
}

export function useKB4ByDepartment() {
  return useQuery({
    queryKey: ['kb4', 'by-department'],
    queryFn: async () => {
      const { data } = await api.get('/kb4/by-department');
      return data;
    },
  });
}

export function useKB4HighRisk(limit = 20) {
  return useQuery({
    queryKey: ['kb4', 'high-risk', limit],
    queryFn: async () => {
      const { data } = await api.get('/kb4/high-risk', { params: { limit } });
      return data;
    },
  });
}
