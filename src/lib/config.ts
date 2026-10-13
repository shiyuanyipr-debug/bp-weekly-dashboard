import type { DashboardSettings } from "./types";

export const PROJECT_RECEIPT_RATES: Record<string, number> = {
  "新仙魔九界": 0.72, "捕鱼大世界": 0.78, "捕鱼达人千炮版3D": 0.76,
  "猎鱼达人": 0.82, "捕鱼游戏王": 0.75, "猎鱼PC": 0.88, "越南捕鱼": 0.73,
  HGI: 0.70, Okey101: 0.72, "波克斗地主": 0.84, "哈灵": 0.80,
  Bigbossslots: 0.70, dominocafe: 0.72, HS: 0.68, "呖咕麻将": 0.83,
  bossdomino: 0.71, dummy: 0.70, "一路狂飙": 0.76, "仙尘小径": 0.79,
  MergeRestyle: 0.70, MaxNovel: 0.92, Maxreel: 0.70,
};

export const DEFAULT_SETTINGS: DashboardSettings = {
  id: "main",
  rules: {
    matureRevenueDeclineWeeks: 3,
    matureProfitDeclineWeeks: 3,
    focusDeclineWeeks: 4,
    focusAchievementThreshold: 0.6,
    cumulativeWindowShort: 4,
    cumulativeWindowLong: 8,
  },
  baselines: [
    { id: "棋牌-启动期", line: "棋牌", lifecycle: "启动期", retentionDay2: 0.37, monthlyRetention: 0.10 },
    { id: "棋牌-成长期", line: "棋牌", lifecycle: "成长期", retentionDay2: 0.37, monthlyRetention: 0.10 },
  ],
  activeReceiptMonth: "2026-10",
  receiptRates: { "2026-10": PROJECT_RECEIPT_RATES },
  updatedBy: "",
  changeNote: "作品集初始模拟配置",
  updatedAt: "",
};
