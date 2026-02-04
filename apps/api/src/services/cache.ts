/**
 * 緩存服務
 * 提供內存緩存支持，可選 Redis 支持
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // 秒
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // 每分鐘清理過期項目
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl ?? 300; // 默認 5 分鐘
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async keys(pattern = '*'): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt && regex.test(key)) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// 緩存 Key 前綴
export const CacheKeys = {
  DASHBOARD: 'dashboard:main',
  DASHBOARD_SUMMARY: 'dashboard:summary',
  KB4_STATS: 'kb4:stats',
  KB4_BY_DEPT: 'kb4:by-dept',
  KB4_HIGH_RISK: 'kb4:high-risk',
  NCM_STATS: 'ncm:stats',
  NCM_BY_PRIORITY: 'ncm:by-priority',
  NCM_CRITICAL: 'ncm:critical',
  EDR_STATS: 'edr:stats',
  EDR_PENDING: 'edr:pending',
  EDR_TIMELINE: 'edr:timeline',
  HIBP_STATS: 'hibp:stats',
  HIBP_PENDING: 'hibp:pending',
  HIBP_TIMELINE: 'hibp:timeline',
  TRENDS_DAILY: 'trends:daily',
  TRENDS_RISK: 'trends:risk',
  SYNC_STATUS: 'sync:status',
  HEALTH: 'health:detailed',
} as const;

// TTL 配置 (秒)
export const CacheTTL = {
  DASHBOARD: 60,        // 1 分鐘
  SUMMARY: 30,          // 30 秒
  STATS: 120,           // 2 分鐘
  LISTS: 60,            // 1 分鐘
  TRENDS: 300,          // 5 分鐘
  HEALTH: 10,           // 10 秒
} as const;

// 創建緩存實例
const memoryCache = new MemoryCache();

// 導出緩存服務
export const cache = {
  /**
   * 獲取緩存值
   */
  get: <T>(key: string) => memoryCache.get<T>(key),

  /**
   * 設置緩存值
   */
  set: <T>(key: string, value: T, ttl?: number) =>
    memoryCache.set(key, value, { ttl }),

  /**
   * 刪除緩存
   */
  del: (key: string) => memoryCache.del(key),

  /**
   * 按模式刪除緩存
   */
  delPattern: (pattern: string) => memoryCache.delPattern(pattern),

  /**
   * 清空所有緩存
   */
  flush: () => memoryCache.flush(),

  /**
   * 檢查緩存是否存在
   */
  has: (key: string) => memoryCache.has(key),

  /**
   * 獲取所有緩存鍵
   */
  keys: (pattern?: string) => memoryCache.keys(pattern),

  /**
   * 獲取緩存統計
   */
  stats: () => memoryCache.stats(),

  /**
   * 緩存包裝器 - 自動處理緩存邏輯
   */
  wrap: async <T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> => {
    const cached = await memoryCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await memoryCache.set(key, value, { ttl });
    return value;
  },

  /**
   * 使緩存失效（同步後調用）
   */
  invalidateSource: async (source: 'kb4' | 'ncm' | 'edr' | 'hibp' | 'all') => {
    if (source === 'all') {
      await memoryCache.flush();
      return;
    }

    // 刪除相關緩存
    await memoryCache.delPattern(`${source}:*`);
    await memoryCache.del(CacheKeys.DASHBOARD);
    await memoryCache.del(CacheKeys.DASHBOARD_SUMMARY);
    await memoryCache.delPattern('trends:*');
  },
};

// 在同步完成後使緩存失效的 hook
export function onSyncComplete(source: 'kb4' | 'ncm' | 'edr' | 'hibp' | 'all') {
  cache.invalidateSource(source);
}
