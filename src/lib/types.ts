export type MetricKey =
  | "dau"
  | "dailyRevenue"
  | "weeklyRevenue"
  | "dailySpend"
  | "registrations"
  | "arpu"
  | "payRate"
  | "arppu"
  | "cpi"
  | "roiDay1"
  | "roiDay2"
  | "roiDay7"
  | "retentionDay1"
  | "retentionDay2"
  | "retentionDay7"
  | "dailyRevenueTarget"
  | "revenueAchievement"
  | "dailySpendTarget"
  | "spendAchievement"
  | "receiptRate";

export type ProjectRecord = {
  key: string;
  line: string;
  region: string;
  group: string;
  project: string;
  bp: string;
  week: string;
  weekOrder: number;
  lifecycle: string;
  metrics: Partial<Record<MetricKey, number>>;
  financeNote: string;
  productNote: string;
  businessUpdate: string;
};

export type ImportResult = {
  fileName: string;
  records: ProjectRecord[];
  projects: number;
  weeks: string[];
  formulaResults: number;
  issues: string[];
};

export type Status = "需关注" | "正常" | "优良" | "数据不足" | "不适用";

export type DerivedMetrics = {
  weeklyRevenue?: number;
  revenue?: number;
  weeklySpend?: number;
  grossProfit?: number;
  grossMargin?: number;
  weeklyRevenueTarget?: number;
  weeklySpendTarget?: number;
  revenueAchievement?: number;
  spendAchievement?: number;
  revenueWow?: number;
  grossProfitWow?: number;
};

export type ProjectSnapshot = {
  record: ProjectRecord;
  history: ProjectRecord[];
  derived: DerivedMetrics;
  status: Status;
  statusReasons: string[];
  focusReasons: string[];
};

export type BpNote = {
  id: string;
  projectKey: string;
  week: string;
  editor: string;
  problem: string;
  actions: string;
  progress: string;
  nextPlan: string;
  collaboration: string;
  highlight: boolean;
  updatedAt: string;
};

export type AiScene = "overview" | "line" | "project";
export type AiResult = Record<string, string>;

