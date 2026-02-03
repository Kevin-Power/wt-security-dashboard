// KB4 原始資料類型
export interface KB4RawRow {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
  division: string;
  location: string;
  job_title: string;
  manager_name: string;
  manager_email: string;
  employee_number: string;
  status: string;
  archived_at: string;
  joined_on: string;
  last_sign_in: string;
  employee_start_date: string;
  current_risk_score: string;
  phish_prone_percentage: string;
  organization: string;
  comment: string;
  last_synced: string;
}

// NCM 原始資料類型
export interface NCMRawRow {
  UpdatePriority: string;
  FW_Series: string;
  FW_Version: string;
  HW_Models: string;
  TotalDeviceCount: string;
  P0_ImmediateCount: string;
  TotalCVEInstances: string;
  MaxKEV_ActiveExploit: string;
  MaxCriticalCVE: string;
  MaxCVSS: string;
  AllDeviceNames: string;
  AllDeviceIPs: string;
  ActionRequired: string;
}

// EDR 原始資料類型 (中文欄位名)
export interface EDRRawRow {
  '伺服器性': string;
  '偵測時間': string;
  '主機名稱': string;
  'IOA 名稱': string;
  '針對此偵測的特定資料': string;
  '可疑檔案的 SHA256': string;
  '檔案路徑': string;
  'VT verdict': string;
}

// HIBP 原始資料類型
export interface HIBPRawRow {
  Timestamp: string;
  RunId: string;
  Domain: string;
  Email: string;
  Alias: string;
  BreachName: string;
  BreachDate: string;
}
