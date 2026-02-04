// Dashboard
export interface DashboardData {
  timestamp: string;
  overallRiskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  sources: {
    kb4: KB4Stats;
    ncm: NCMStats;
    edr: EDRStats;
    hibp: HIBPStats;
  };
}

export interface KB4Stats {
  totalUsers: number;
  highRiskUsers: number;
  avgRiskScore: number;
  avgPhishProneRate: number;
  riskPercentage: number;
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
