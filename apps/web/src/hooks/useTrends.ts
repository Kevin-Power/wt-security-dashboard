import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useTrendsRiskScore(days = 30) {
  return useQuery({
    queryKey: ['trends', 'risk-score', days],
    queryFn: async () => {
      const { data } = await api.get('/trends/risk-score', { params: { days } });
      return data;
    },
  });
}

export function useTrendsComparison() {
  return useQuery({
    queryKey: ['trends', 'comparison'],
    queryFn: async () => {
      const { data } = await api.get('/trends/comparison');
      return data;
    },
  });
}

export function useTrendsKB4(days = 30) {
  return useQuery({
    queryKey: ['trends', 'kb4', days],
    queryFn: async () => {
      const { data } = await api.get('/trends/kb4', { params: { days } });
      return data;
    },
  });
}

export function useTrendsNCM(days = 30) {
  return useQuery({
    queryKey: ['trends', 'ncm', days],
    queryFn: async () => {
      const { data } = await api.get('/trends/ncm', { params: { days } });
      return data;
    },
  });
}

export function useTrendsEDR(days = 30) {
  return useQuery({
    queryKey: ['trends', 'edr', days],
    queryFn: async () => {
      const { data } = await api.get('/trends/edr', { params: { days } });
      return data;
    },
  });
}

export function useTrendsHIBP(days = 30) {
  return useQuery({
    queryKey: ['trends', 'hibp', days],
    queryFn: async () => {
      const { data } = await api.get('/trends/hibp', { params: { days } });
      return data;
    },
  });
}
