import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type {
  DashboardData,
  DashboardSummary,
  DashboardConfig,
  RiskBreakdown,
  RiskWeights,
  SyncStatus,
  HealthStatus,
} from '@/types/api';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  main: () => [...dashboardKeys.all, 'main'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  config: () => [...dashboardKeys.all, 'config'] as const,
  breakdown: () => [...dashboardKeys.all, 'breakdown'] as const,
};

export const syncKeys = {
  all: ['sync'] as const,
  status: () => [...syncKeys.all, 'status'] as const,
  logs: (limit?: number) => [...syncKeys.all, 'logs', limit] as const,
};

export const healthKeys = {
  all: ['health'] as const,
  detailed: () => [...healthKeys.all, 'detailed'] as const,
};

// Dashboard hooks
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.main(),
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/dashboard');
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>('/dashboard/summary');
      return data;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useDashboardConfig() {
  return useQuery({
    queryKey: dashboardKeys.config(),
    queryFn: async () => {
      const { data } = await api.get<DashboardConfig>('/dashboard/config');
      return data;
    },
    staleTime: 300000, // 5 minutes
  });
}

export function useRiskBreakdown() {
  return useQuery({
    queryKey: dashboardKeys.breakdown(),
    queryFn: async () => {
      const { data } = await api.get<RiskBreakdown>('/dashboard/breakdown');
      return data;
    },
    staleTime: 60000,
  });
}

// Update risk weights mutation
export function useUpdateRiskWeights() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weights: Partial<RiskWeights>) => {
      const { data } = await api.put('/dashboard/weights', weights);
      return data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

// Sync hooks
export function useSyncStatus() {
  return useQuery({
    queryKey: syncKeys.status(),
    queryFn: async () => {
      const { data } = await api.get<SyncStatus>('/sync/status');
      return data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useSyncLogs(limit = 50) {
  return useQuery({
    queryKey: syncKeys.logs(limit),
    queryFn: async () => {
      const { data } = await api.get(`/sync/logs?limit=${limit}`);
      return data;
    },
    staleTime: 30000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (source: 'all' | 'kb4' | 'ncm' | 'edr' | 'hibp' = 'all') => {
      const { data } = await api.post(`/sync?source=${source}`);
      return data;
    },
    onSuccess: () => {
      // Invalidate all queries after sync
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: syncKeys.all });
    },
  });
}

// Health hooks
export function useHealthStatus() {
  return useQuery({
    queryKey: healthKeys.detailed(),
    queryFn: async () => {
      const { data } = await api.get<HealthStatus>('/health/detailed');
      return data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// Cache management
export function useClearCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/cache/clear');
      return data;
    },
    onSuccess: () => {
      // Clear all client-side queries too
      queryClient.clear();
    },
  });
}

// Prefetch helper
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.main(),
      queryFn: async () => {
        const { data } = await api.get<DashboardData>('/dashboard');
        return data;
      },
    });
  };
}
