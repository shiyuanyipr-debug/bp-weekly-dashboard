import type ExcelJS from "exceljs";
import type { ImportResult, MetricKey, ProjectRecord } from "./types";

type Canonical =
  | "line" | "region" | "group" | "project" | "bp" | "week" | "lifecycle"
  | "financeNote" | "productNote" | "businessUpdate" | MetricKey;

const aliases: Record<Canonical, string[]> = {
  line: ["业务线"], region: ["地区"], group: ["项目组"], project: ["项目名称", "项目"],
  bp: ["财务BP", "财务 BP"], week: ["周次", "数据周次"], lifecycle: ["生命周期阶段", "生命周期"],
  dau: ["DAU", "日活"], dailyRevenue: ["日均流水", "日流水"], weeklyRevenue: ["周流水"],
  dailySpend: ["投放日耗", "日投放消耗", "日消耗"], registrations: ["注册人数", "新增注册"],
  arpu: ["ARPU"], payRate: ["付费率"], arppu: ["ARPPU"], cpi: ["CPI"], roiDay1: ["ROI-首日", "首日ROI"],
  roiDay2: ["ROI-次日", "次日ROI"], roiDay7: ["ROI-七日", "七日ROI", "7日ROI"],
  retentionDay1: ["留存-首日", "首日留存"], retentionDay2: ["留存-次日", "次日留存", "次留"],
  retentionDay7: ["留存-七日", "七日留存", "7日留存"], dailyRevenueTarget: ["日流水目标"],
  revenueAchievement: ["日流水达成率", "日流水目标达成率"], dailySpendTarget: ["日投放目标", "日消耗目标"],
  spendAchievement: ["日投放达成率", "日消耗达成率"], receiptRate: ["实收率", "项目实收率"],
  financeNote: ["财务核心指标及BP重点推进事项", "财务核心指标及 BP 重点推进事项"],
  productNote: ["近期产品核心指标达成情况及BP推进事项进展", "近期产品核心指标达成情况及 BP 推进事项进展"],
  businessUpdate: ["业务关键动态"],
};

const normalize = (value: unknown) => String(value ?? "").replace(/[\s\n\r_]/g, "").replace(/[()（）]/g, "").toUpperCase();
const aliasMap = new Map<string, Canonical>();
Object.entries(aliases).forEach(([key, values]) => values.forEach((value) => aliasMap.set(normalize(value), key as Canonical)));

function plainValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return value;
}

function numeric(value: ExcelJS.CellValue): number | undefined {
  const raw = plainValue(value);
  if (raw === null || raw === undefined || raw === "") return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const parsed = Number(String(raw).replace(/[%,$￥,]/g, ""));
  if (!Number.isFinite(parsed)) return undefined;
  return String(raw).includes("%") ? parsed / 100 : parsed;
}

function text(value: ExcelJS.CellValue): string {
  return String(plainValue(value) ?? "").trim();
}

function weekOrder(week: string): number {
  const match = week.match(/(?:20\d{2}[-/])?W?(\d{1,2})/i);
  return match ? Number(match[1]) : Number.NaN;
}

export async function parseWorkbook(file: File | Blob, fileName: string): Promise<ImportResult> {
  const { default: ExcelRuntime } = await import("exceljs");
  const workbook = new ExcelRuntime.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  let winner: { sheet: ExcelJS.Worksheet; row: number; columns: Map<number, Canonical>; score: number } | undefined;

  workbook.eachSheet((sheet) => {
    for (let rowNumber = 1; rowNumber <= Math.min(10, sheet.rowCount); rowNumber += 1) {
      const columns = new Map<number, Canonical>();
      sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, column) => {
        const key = aliasMap.get(normalize(plainValue(cell.value)));
        if (key) columns.set(column, key);
      });
      const required = ["line", "project", "week"].filter((key) => [...columns.values()].includes(key as Canonical)).length;
      const score = columns.size + required * 10;
      if (required === 3 && (!winner || score > winner.score)) winner = { sheet, row: rowNumber, columns, score };
    }
  });
  if (!winner) throw new Error("未找到同时包含业务线、项目名称和周次的数据表。");

  const records: ProjectRecord[] = [];
  const projectKeys = new Set<string>();
  const issues: string[] = [];
  let formulaResults = 0;
  let blankWeekRows = 0;
  for (let rowNumber = winner.row + 1; rowNumber <= winner.sheet.rowCount; rowNumber += 1) {
    const row = winner.sheet.getRow(rowNumber);
    const values = new Map<Canonical, ExcelJS.CellValue>();
    winner.columns.forEach((key, column) => {
      const value = row.getCell(column).value;
      values.set(key, value);
    });
    row.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value) && "result" in value && value.result !== undefined) formulaResults += 1;
    });
    const project = text(values.get("project") ?? null);
    if (!project) continue;
    const projectLine = text(values.get("line") ?? null) || "未分类";
    const projectRegion = text(values.get("region") ?? null) || "未分类";
    const projectGroup = text(values.get("group") ?? null) || "未分类";
    projectKeys.add([projectLine, projectRegion, projectGroup, project].join("|"));
    const week = text(values.get("week") ?? null);
    if (!week) { blankWeekRows += 1; continue; }
    const order = weekOrder(week);
    if (!Number.isFinite(order)) { issues.push(`第 ${rowNumber} 行的周次“${week}”无法解析`); continue; }
    const line = text(values.get("line") ?? null) || "未分类";
    const region = text(values.get("region") ?? null) || "未分类";
    const group = text(values.get("group") ?? null) || "未分类";
    const metrics: ProjectRecord["metrics"] = {};
    (["dau","dailyRevenue","weeklyRevenue","dailySpend","registrations","arpu","payRate","arppu","cpi","roiDay1","roiDay2","roiDay7","retentionDay1","retentionDay2","retentionDay7","dailyRevenueTarget","revenueAchievement","dailySpendTarget","spendAchievement","receiptRate"] as MetricKey[])
      .forEach((key) => { const value = numeric(values.get(key) ?? null); if (value !== undefined) metrics[key] = value; });
    if (metrics.weeklyRevenue === undefined && metrics.dailyRevenue !== undefined) metrics.weeklyRevenue = metrics.dailyRevenue * 7;
    records.push({
      key: [line, region, group, project].join("|") , line, region, group, project,
      bp: text(values.get("bp") ?? null), week, weekOrder: order,
      lifecycle: text(values.get("lifecycle") ?? null) || "未知",
      metrics,
      financeNote: text(values.get("financeNote") ?? null),
      productNote: text(values.get("productNote") ?? null),
      businessUpdate: text(values.get("businessUpdate") ?? null),
    });
  }
  if (blankWeekRows) issues.push(`${blankWeekRows} 条项目占位记录没有周次，已标记为数据问题，未进入计算。`);
  const recognized = new Set(winner.columns.values());
  ["dailySpend", "dailyRevenueTarget", "dailySpendTarget", "lifecycle"].forEach((key) => {
    if (!recognized.has(key as Canonical)) issues.push(`未识别字段：${aliases[key as Canonical][0]}`);
  });
  const weeks = [...new Map(records.sort((a, b) => a.weekOrder - b.weekOrder).map((record) => [record.week, record.week])).values()];
  return { fileName, records, projects: projectKeys.size, weeks, formulaResults, issues };
}
