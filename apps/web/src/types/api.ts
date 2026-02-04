// Risk Weights
export interface RiskWeights {
  kb4: number;
  ncm: number;
  edr: number;
  hibp: number;
}

// Data Quality
export interface DataQuality {
  hasData: boolean;
  warnings: string[];
}

// Dashboard
export interface DashboardData {
  timestamp: string;
  overallRiskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  riskColor: string;
  weights: RiskWeights;
  sources: {
    kb4: KB4Stats;
    ncm: NCMStats;
    edr: EDRStats;
    hibp: HIBPStats;
  };
  dataQuality: DataQuality;
}

export interface DashboardSummary {
  timestamp: string;
  counts: {
    kb4_users: number;
    ncm_devices: number;
    edr_pending_alerts: number;
    edr_new_alerts: number;
    hibp_new_breaches: number;
  };
  lastSync: {
    at: string;
    status: string;
  } | null;
}

export interface DashboardConfig {
  timestamp: string;
  config: {
    weights: RiskWeights;
    thresholds: Record<string, number>;
    factors: Record<string, number>;
  };
}

export interface RiskBreakdown {
  timestamp: string;
  breakdown: {
    kb4: SourceBreakdown;
    ncm: SourceBreakdown;
    edr: SourceBreakdown;
    hibp: SourceBreakdown;
  };
  calculationFactors: Record<string, number>;
}

export interface SourceBreakdown {
  weight: number;
  rawScore: number;
  weightedScore: number;
  factors: Record<string, number>;
}

export interface KB4Stats {
  totalUsers: number;
  highRiskUsers: number;
  avgRiskScore: number;
  avgPhishProneRate: number;
  riskPercentage: number;
  score: number;
}

export interface NCMStats {
  totalDevices: number;
  byPriority: {
    p0_immediate: number;
    p1_next_cycle: number;
    p3_monitor: number;
  };
  avgMaxCvss: number;
  totalCveInstances: number;
  criticalPercentage: number;
  score: number;
}

export interface EDRStats {
  totalAlerts: number;
  byStatus: {
    new: number;
    investigating: number;
    resolved: number;
    false_positive: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  pendingCount: number;
  pendingPercentage: number;
  highSeverityPercentage: number;
  score: number;
}

export interface HIBPStats {
  totalBreaches: number;
  byStatus: {
    new: number;
    notified: number;
    password_reset: number;
    resolved: number;
  };
  recentBreaches: number;
  pendingCount: number;
  score: number;
}

// KB4
export interface KB4User {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string | null;
  division: string | null;
  organization: string | null;
  jobTitle: string | null;
  status: string;
  currentRiskScore: number;
  phishPronePercentage: number;
  lastSignIn: string | null;
  syncedAt: string;
}

// NCM
export interface NCMDevice {
  id: string;
  deviceName: string;
  deviceIp: string | null;
  hwModel: string | null;
  fwSeries: string | null;
  fwVersion: string | null;
  updatePriority: string;
  totalCveInstances: number;
  maxKevActiveExploit: number;
  maxCriticalCve: number;
  maxCvss: number;
  actionRequired: string | null;
  syncedAt: string;
}

// EDR
export interface EDRAlert {
  id: string;
  severity: string;
  detectedAt: string;
  hostname: string;
  ioaName: string;
  domain: string | null;
  fileSha256: string | null;
  filePath: string | null;
  vtVerdict: string | null;
  status: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  syncedAt: string;
}

// HIBP
export interface HIBPBreach {
  id: string;
  domain: string;
  email: string;
  alias: string | null;
  breachName: string;
  breachDate: string | null;
  discoveredAt: string;
  status: string;
  syncedAt: string;
}

// Trends
export interface TrendData {
  date: string;
  riskScore?: number;
  totalUsers?: number;
  highRiskUsers?: number;
  avgRiskScore?: number;
  totalDevices?: number;
  p0Devices?: number;
  totalAlerts?: number;
  pendingAlerts?: number;
  totalBreaches?: number;
  newBreaches?: number;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Sync
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastSyncResult: {
    kb4: { success: boolean; count: number };
    ncm: { success: boolean; count: number };
    edr: { success: boolean; count: number };
    hibp: { success: boolean; count: number };
    totalDuration: number;
  } | null;
}

export interface SyncLog {
  id: string;
  source: string;
  status: string;
  recordCount: number;
  duration: number;
  error: string | null;
  createdAt: string;
}

// Health
export interface HealthStatus {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      latency: number;
    };
    sync: {
      isRunning: boolean;
      lastRun: string | null;
      lastResult: SyncStatus['lastSyncResult'];
    };
    cache: {
      entries: number;
    };
  };
  data: {
    kb4Users: number;
    ncmDevices: number;
    edrAlerts: number;
    hibpBreaches: number;
  };
  lastSyncLogs: SyncLog[];
  responseTime: number;
}
