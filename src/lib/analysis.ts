import type { DerivedMetrics, ProjectRecord, ProjectSnapshot, Status } from "./types";

const ratio = (value?: number, base?: number) => value === undefined || base === undefined || base === 0 ? undefined : value / base;
const isDeclining = (values: Array<number | undefined>, count: number) => {
  const slice = values.slice(-count);
  return slice.length === count && slice.every((value) => value !== undefined) && slice.every((value, index) => index === 0 || value! < slice[index - 1]!);
};

export function derive(record: ProjectRecord, previous?: ProjectRecord): DerivedMetrics {
  const weeklyRevenue = record.metrics.weeklyRevenue;
  const weeklySpend = record.metrics.dailySpend === undefined ? undefined : record.metrics.dailySpend * 7;
  const revenue = weeklyRevenue !== undefined && record.metrics.receiptRate !== undefined ? weeklyRevenue * record.metrics.receiptRate : undefined;
  const grossProfit = revenue !== undefined && weeklySpend !== undefined ? revenue - weeklySpend : undefined;
  const weeklyRevenueTarget = record.metrics.dailyRevenueTarget === undefined ? undefined : record.metrics.dailyRevenueTarget * 7;
  const weeklySpendTarget = record.metrics.dailySpendTarget === undefined ? undefined : record.metrics.dailySpendTarget * 7;
  const previousDerived = previous ? derive(previous) : undefined;
  return {
    weeklyRevenue, weeklySpend, revenue, grossProfit,
    grossMargin: ratio(grossProfit, revenue), weeklyRevenueTarget, weeklySpendTarget,
    revenueAchievement: ratio(weeklyRevenue, weeklyRevenueTarget) ?? record.metrics.revenueAchievement,
    spendAchievement: ratio(weeklySpend, weeklySpendTarget) ?? record.metrics.spendAchievement,
    revenueWow: ratio(weeklyRevenue, previousDerived?.weeklyRevenue) === undefined ? undefined : ratio(weeklyRevenue, previousDerived?.weeklyRevenue)! - 1,
    grossProfitWow: ratio(grossProfit, previousDerived?.grossProfit) === undefined ? undefined : ratio(grossProfit, previousDerived?.grossProfit)! - 1,
  };
}

function evaluate(history: ProjectRecord[], current: ProjectRecord): { status: Status; reasons: string[]; focus: string[] } {
  const reasons: string[] = [];
  const focus: string[] = [];
  const lifecycle = current.lifecycle;
  const derivedHistory = history.map((record, index) => derive(record, history[index - 1]));
  const currentDerived = derivedHistory.at(-1)!;
  const revenueValues = derivedHistory.map((item) => item.weeklyRevenue);
  const grossProfitValues = derivedHistory.map((item) => item.grossProfit);
  if (isDeclining(revenueValues, 4)) focus.push("周流水连续 4 周下降");
  if (isDeclining(history.map((item) => item.metrics.dailySpend), 4)) focus.push("投放日耗连续 4 周下降（仅作趋势提示）");
  if (isDeclining(history.map((item) => item.metrics.retentionDay2), 4)) focus.push("次日留存连续 4 周下降");
  if (isDeclining(history.map((item) => item.metrics.roiDay7), 4)) focus.push("七日 ROI 连续 4 周下降");
  if (currentDerived.revenueAchievement !== undefined && currentDerived.revenueAchievement < 0.6) focus.push("日流水达成率低于 60%");
  if (currentDerived.spendAchievement !== undefined && currentDerived.spendAchievement < 0.6) focus.push("日投放达成率低于 60%");

  if (lifecycle.includes("研发")) return { status: "不适用", reasons: ["研发期不做经营回收判断"], focus };
  if (lifecycle.includes("启动") || lifecycle.includes("成长")) {
    if (!current.line.includes("棋牌") || current.metrics.retentionDay2 === undefined) return { status: "数据不足", reasons: ["没有可比较的业务线×生命周期基线"], focus };
    if (current.metrics.retentionDay2 < 0.37) return { status: "需关注", reasons: [`次留 ${Math.round(current.metrics.retentionDay2 * 1000) / 10}% 低于棋牌基线 37%`], focus };
    return { status: "优良", reasons: ["所有已配置基线指标均达标"], focus };
  }
  if (lifecycle.includes("成熟")) {
    if (isDeclining(revenueValues, 3)) reasons.push("流水连续 3 周下降");
    if (isDeclining(grossProfitValues, 3)) reasons.push("经营毛利连续 3 周下降");
    [4, 8].forEach((window) => {
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

export function snapshots(records: ProjectRecord[], week: string): ProjectSnapshot[] {
  const selected = records.filter((record) => record.week === week);
  return selected.map((record) => {
    const history = records.filter((item) => item.key === record.key && item.weekOrder <= record.weekOrder).sort((a, b) => a.weekOrder - b.weekOrder);
    const result = evaluate(history, record);
    return { record, history, derived: derive(record, history.at(-2)), status: result.status, statusReasons: result.reasons, focusReasons: result.focus };
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

