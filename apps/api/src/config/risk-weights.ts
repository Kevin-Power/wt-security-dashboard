/**
 * SSC (Security Score Card) 風險權重配置
 * 支持從環境變量自定義權重
 */

import { z } from 'zod';

// 權重配置 Schema
const riskWeightsSchema = z.object({
  kb4: z.number().min(0).max(1).default(0.20),
  ncm: z.number().min(0).max(1).default(0.35),
  edr: z.number().min(0).max(1).default(0.30),
  hibp: z.number().min(0).max(1).default(0.15),
});

// 風險等級閾值 Schema
const riskThresholdsSchema = z.object({
  // KB4 閾值
  kb4HighRiskScore: z.number().default(50),
  kb4HighPhishRate: z.number().default(20),

  // NCM 閾值
  ncmCriticalCvss: z.number().default(9.0),
  ncmHighCvss: z.number().default(7.0),

  // 風險等級分數閾值
  criticalScore: z.number().default(80),
  highScore: z.number().default(60),
  mediumScore: z.number().default(40),
  lowScore: z.number().default(20),
});

// 風險計算因子 Schema
const riskFactorsSchema = z.object({
  // KB4 因子
  kb4RiskPercentageMultiplier: z.number().default(2),
  kb4AvgScoreWeight: z.number().default(1),

  // NCM 因子
  ncmCriticalPercentageMultiplier: z.number().default(3),
  ncmCvssMultiplier: z.number().default(8),

  // EDR 因子
  edrPendingWeight: z.number().default(1),
  edrHighSeverityWeight: z.number().default(1),

  // HIBP 因子
  hibpPendingMultiplier: z.number().default(10),
});

export type RiskWeights = z.infer<typeof riskWeightsSchema>;
export type RiskThresholds = z.infer<typeof riskThresholdsSchema>;
export type RiskFactors = z.infer<typeof riskFactorsSchema>;

// 從環境變量解析權重
function parseWeightsFromEnv(): RiskWeights {
  const envWeights = process.env.RISK_WEIGHTS;
  if (envWeights) {
    try {
      const parsed = JSON.parse(envWeights);
      const validated = riskWeightsSchema.parse(parsed);

      // 驗證權重總和為 1
      const total = validated.kb4 + validated.ncm + validated.edr + validated.hibp;
      if (Math.abs(total - 1) > 0.001) {
        console.warn(`Risk weights sum to ${total}, normalizing...`);
        return {
          kb4: validated.kb4 / total,
          ncm: validated.ncm / total,
          edr: validated.edr / total,
          hibp: validated.hibp / total,
        };
      }
      return validated;
    } catch {
      console.warn('Invalid RISK_WEIGHTS format, using defaults');
    }
  }
  return riskWeightsSchema.parse({});
}

function parseThresholdsFromEnv(): RiskThresholds {
  const envThresholds = process.env.RISK_THRESHOLDS;
  if (envThresholds) {
    try {
      return riskThresholdsSchema.parse(JSON.parse(envThresholds));
    } catch {
      console.warn('Invalid RISK_THRESHOLDS format, using defaults');
    }
  }
  return riskThresholdsSchema.parse({});
}

function parseFactorsFromEnv(): RiskFactors {
  const envFactors = process.env.RISK_FACTORS;
  if (envFactors) {
    try {
      return riskFactorsSchema.parse(JSON.parse(envFactors));
    } catch {
      console.warn('Invalid RISK_FACTORS format, using defaults');
    }
  }
  return riskFactorsSchema.parse({});
}

// 導出配置對象
export const riskConfig = {
  weights: parseWeightsFromEnv(),
  thresholds: parseThresholdsFromEnv(),
  factors: parseFactorsFromEnv(),
};

// 獲取風險等級
export function getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' | 'minimal' {
  const { criticalScore, highScore, mediumScore, lowScore } = riskConfig.thresholds;

  if (score >= criticalScore) return 'critical';
  if (score >= highScore) return 'high';
  if (score >= mediumScore) return 'medium';
  if (score >= lowScore) return 'low';
  return 'minimal';
}

// 獲取風險等級顏色
export function getRiskColor(level: string): string {
  const colors: Record<string, string> = {
    critical: '#dc2626', // red-600
    high: '#ea580c',     // orange-600
    medium: '#ca8a04',   // yellow-600
    low: '#16a34a',      // green-600
    minimal: '#22c55e',  // green-500
  };
  return colors[level] || '#6b7280'; // gray-500
}

// 運行時更新權重（用於 API 動態調整）
export function updateRiskWeights(newWeights: Partial<RiskWeights>): RiskWeights {
  const merged = { ...riskConfig.weights, ...newWeights };
  const total = merged.kb4 + merged.ncm + merged.edr + merged.hibp;

  if (Math.abs(total - 1) > 0.001) {
    // 正規化權重
    riskConfig.weights = {
      kb4: merged.kb4 / total,
      ncm: merged.ncm / total,
      edr: merged.edr / total,
      hibp: merged.hibp / total,
    };
  } else {
    riskConfig.weights = merged;
  }

  return riskConfig.weights;
}

// 獲取當前配置（用於 API 響應）
export function getRiskConfig() {
  return {
    weights: riskConfig.weights,
    thresholds: riskConfig.thresholds,
    factors: riskConfig.factors,
  };
}
