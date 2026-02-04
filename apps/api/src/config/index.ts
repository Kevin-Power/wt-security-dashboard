import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional().transform(key => key?.replace(/\\n/g, '\n')),
  SHEET_ID_KB4: z.string(),
  SHEET_ID_NCM: z.string(),
  SHEET_ID_EDR: z.string(),
  SHEET_ID_HIBP: z.string(),
  SYNC_INTERVAL: z.coerce.number().default(15),
  JWT_SECRET: z.string().default('wt-security-dashboard-secret-key-2024'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export const env = envSchema.parse(process.env);

export const sheetsConfig = {
  kb4: {
    id: env.SHEET_ID_KB4,
    range: '外部!A:U',
  },
  ncm: {
    id: env.SHEET_ID_NCM,
    range: '15_FW_Version_VulnSummary!A:M',
  },
  edr: {
    id: env.SHEET_ID_EDR,
    range: 'ODS_VT!A:H',
  },
  hibp: {
    id: env.SHEET_ID_HIBP,
    range: 'HIBP_Report!A:F',
  },
};
