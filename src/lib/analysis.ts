import { DEFAULT_SETTINGS } from "./config";
import type { DashboardSettings, DerivedMetrics, ProjectRecord, ProjectSnapshot, Status } from "./types";

const ratio = (value?: number, base?: number) => value === undefined || base === undefined || base === 0 ? undefined : value / base;
const isDeclining = (values: Array<number | undefined>, count: number) => {
  const slice = values.slice(-count);
  return slice.length === count && slice.every((value) => value !== undefined) && slice.every((value, index) => index === 0 || value! < slice[index - 1]!);
};

export function derive(record: ProjectRecord, previous?: ProjectRecord, settings: DashboardSettings = DEFAULT_SETTINGS): DerivedMetrics {
  const weeklyRevenue = record.metrics.weeklyRevenue;
  const weeklySpend = record.metrics.dailySpend === undefined ? undefined : record.metrics.dailySpend * 7;
  const receiptRate = record.metrics.receiptRate ?? settings.receiptRates[settings.activeReceiptMonth]?.[record.project];
  const revenue = weeklyRevenue !== undefined && receiptRate !== undefined ? weeklyRevenue * receiptRate : undefined;
  const grossProfit = revenue !== undefined && weeklySpend !== undefined ? revenue - weeklySpend : undefined;
  const weeklyRevenueTarget = record.metrics.dailyRevenueTarget === undefined ? undefined : record.metrics.dailyRevenueTarget * 7;
  const weeklySpendTarget = record.metrics.dailySpendTarget === undefined ? undefined : record.metrics.dailySpendTarget * 7;
  const previousDerived = previous ? derive(previous, undefined, settings) : undefined;
  return {
    weeklyRevenue, weeklySpend, revenue, grossProfit,
    grossMargin: ratio(grossProfit, revenue), weeklyRevenueTarget, weeklySpendTarget,
    revenueAchievement: ratio(weeklyRevenue, weeklyRevenueTarget) ?? record.metrics.revenueAchievement,
    spendAchievement: ratio(weeklySpend, weeklySpendTarget) ?? record.metrics.spendAchievement,
    revenueWow: ratio(weeklyRevenue, previousDerived?.weeklyRevenue) === undefined ? undefined : ratio(weeklyRevenue, previousDerived?.weeklyRevenue)! - 1,
    grossProfitWow: ratio(grossProfit, previousDerived?.grossProfit) === undefined ? undefined : ratio(grossProfit, previousDerived?.grossProfit)! - 1,
  };
}

function evaluate(history: ProjectRecord[], current: ProjectRecord, settings: DashboardSettings): { status: Status; reasons: string[]; focus: string[] } {
  const reasons: string[] = [];
  const focus: string[] = [];
  const lifecycle = current.lifecycle;
  const derivedHistory = history.map((record, index) => derive(record, history[index - 1], settings));
  const currentDerived = derivedHistory.at(-1)!;
  const revenueValues = derivedHistory.map((item) => item.weeklyRevenue);
  const grossProfitValues = derivedHistory.map((item) => item.grossProfit);
  const focusWeeks = settings.rules.focusDeclineWeeks;
  const threshold = settings.rules.focusAchievementThreshold;
  if (isDeclining(revenueValues, focusWeeks)) focus.push(`周流水连续 ${focusWeeks} 周下降`);
  if (isDeclining(history.map((item) => item.metrics.dailySpend), focusWeeks)) focus.push(`投放日耗连续 ${focusWeeks} 周下降（仅作趋势提示）`);
  if (isDeclining(history.map((item) => item.metrics.retentionDay2), focusWeeks)) focus.push(`次日留存连续 ${focusWeeks} 周下降`);
  if (isDeclining(history.map((item) => item.metrics.roiDay7), focusWeeks)) focus.push(`七日 ROI 连续 ${focusWeeks} 周下降`);
  if (currentDerived.revenueAchievement !== undefined && currentDerived.revenueAchievement < threshold) focus.push(`日流水达成率低于 ${Math.round(threshold * 100)}%`);
  if (currentDerived.spendAchievement !== undefined && currentDerived.spendAchievement < threshold) focus.push(`日投放达成率低于 ${Math.round(threshold * 100)}%`);

  if (lifecycle.includes("研发")) return { status: "不适用", reasons: ["研发期不做经营回收判断"], focus };
  if (lifecycle.includes("启动") || lifecycle.includes("成长")) {
    const baseline = settings.baselines.find((item) => current.line.includes(item.line) && lifecycle.includes(item.lifecycle.replace("期", "")));
    if (!baseline) return { status: "数据不足", reasons: ["没有可比较的业务线×生命周期基线"], focus };
    const checks: Array<[number | undefined, number | undefined, string]> = [[current.metrics.retentionDay2, baseline.retentionDay2, "次留"], [current.metrics.roiDay7, baseline.roiDay7, "七日 ROI"], [current.metrics.dau, baseline.dau, "DAU"]];
    const configured = checks.filter(([, base]) => base !== undefined);
    if (!configured.length) return { status: "数据不足", reasons: ["当前基线没有可与周报比较的指标"], focus };
    const missing = configured.filter(([value]) => value === undefined).map(([, , name]) => name);
    if (missing.length) return { status: "数据不足", reasons: [`周报缺少已配置的${missing.join("、")}指标`], focus };
    const failed = configured.filter(([value, base]) => value! < base!).map(([value, base, name]) => `${name} ${name === "DAU" ? value : `${Math.round(value! * 1000) / 10}%`} 低于基线 ${name === "DAU" ? base : `${Math.round(base! * 1000) / 10}%`}`);
    if (failed.length) return { status: "需关注", reasons: failed, focus };
    return { status: "优良", reasons: ["所有已配置基线指标均达标"], focus };
  }
  if (lifecycle.includes("成熟")) {
    const revenueWeeks = settings.rules.matureRevenueDeclineWeeks;
    const profitWeeks = settings.rules.matureProfitDeclineWeeks;
    if (isDeclining(revenueValues, revenueWeeks)) reasons.push(`流水连续 ${revenueWeeks} 周下降`);
    if (isDeclining(grossProfitValues, profitWeeks)) reasons.push(`经营毛利连续 ${profitWeeks} 周下降`);
    [settings.rules.cumulativeWindowShort, settings.rules.cumulativeWindowLong].forEach((window) => {
      const slice = derivedHistory.slice(-window);
      if (slice.length === window && slice.every((item) => item.weeklyRevenueTarget !== undefined)) {
        const actual = slice.reduce((sum, item) => sum + (item.weeklyRevenue ?? 0), 0);
        const target = slice.reduce((sum, item) => sum + (item.weeklyRevenueTarget ?? 0), 0);
        if (actual < target) reasons.push(`${window} 周累计流水未达目标`);
      }
    });
    if (reasons.length) return { status: "需关注", reasons, focus };
    const hasAllPositive = revenueValues.slice(-3).length === 3 && !isDeclining(revenueValues, 3) && !isDeclining(grossProfitValues, 3);
    return { status: hasAllPositive ? "优良" : "正常", reasons: [hasAllPositive ? "可判断的成熟期指标均为正向" : "未触发成熟期异常规则"], focus };
  }
  return { status: "数据不足", reasons: ["生命周期缺失或不在规则范围内"], focus };
}

export function snapshots(records: ProjectRecord[], week: string, settings: DashboardSettings = DEFAULT_SETTINGS): ProjectSnapshot[] {
  const selected = records.filter((record) => record.week === week);
  return selected.map((record) => {
    const history = records.filter((item) => item.key === record.key && item.weekOrder <= record.weekOrder).sort((a, b) => a.weekOrder - b.weekOrder);
    const result = evaluate(history, record, settings);
    return { record, history, derived: derive(record, history.at(-2), settings), status: result.status, statusReasons: result.reasons, focusReasons: result.focus };
  });
}

export function aggregate(items: ProjectSnapshot[]) {
  const sum = (pick: (item: ProjectSnapshot) => number | undefined) => items.reduce((total, item) => total + (pick(item) ?? 0), 0);
  const weeklyRevenue = sum((item) => item.derived.weeklyRevenue);
  const revenue = items.some((item) => item.derived.revenue === undefined) ? undefined : sum((item) => item.derived.revenue);
  const weeklySpend = sum((item) => item.derived.weeklySpend);
  const grossProfit = revenue === undefined ? undefined : sum((item) => item.derived.grossProfit);
  const weeklyRevenueTarget = sum((item) => item.derived.weeklyRevenueTarget);
  const weeklySpendTarget = sum((item) => item.derived.weeklySpendTarget);
  return { weeklyRevenue, revenue, weeklySpend, grossProfit, grossMargin: ratio(grossProfit, revenue), revenueAchievement: ratio(weeklyRevenue, weeklyRevenueTarget), spendAchievement: ratio(weeklySpend, weeklySpendTarget) };
}
