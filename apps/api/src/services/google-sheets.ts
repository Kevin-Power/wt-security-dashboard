import { google, sheets_v4 } from 'googleapis';
import { env, sheetsConfig } from '../config/index.js';
import type { KB4RawRow, NCMRawRow, EDRRawRow, HIBPRawRow } from '../types/sheets.js';

class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null;

  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;

    // 如果沒有設定認證，使用 API Key 模式 (公開試算表)
    if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
      this.sheets = google.sheets({ version: 'v4' });
      return this.sheets;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: env.GOOGLE_PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  async getSheetData<T extends Record<string, string>>(
    spreadsheetId: string,
    range: string
  ): Promise<T[]> {
    const sheets = await this.getClient();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    // 第一行是 header
    const headers = rows[0] as string[];
    const data = rows.slice(1);

    return data.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj as T;
    });
  }

  // 取得 KB4 資料
  async getKB4Data(): Promise<KB4RawRow[]> {
    return this.getSheetData<KB4RawRow>(
      sheetsConfig.kb4.id,
      sheetsConfig.kb4.range
    );
  }

  // 取得 NCM 資料
  async getNCMData(): Promise<NCMRawRow[]> {
    return this.getSheetData<NCMRawRow>(
      sheetsConfig.ncm.id,
      sheetsConfig.ncm.range
    );
  }

  // 取得 EDR 資料
  async getEDRData(): Promise<EDRRawRow[]> {
    return this.getSheetData<EDRRawRow>(
      sheetsConfig.edr.id,
      sheetsConfig.edr.range
    );
  }

  // 取得 HIBP 資料
  async getHIBPData(): Promise<HIBPRawRow[]> {
    return this.getSheetData<HIBPRawRow>(
      sheetsConfig.hibp.id,
      sheetsConfig.hibp.range
    );
  }
}

export const googleSheetsService = new GoogleSheetsService();
