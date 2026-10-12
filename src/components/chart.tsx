"use client";

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export function Chart({ option, height = 300 }: { option: object; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chart.setOption(option as echarts.EChartsOption);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [option]);
  return <div ref={ref} style={{ height }} role="img" aria-label="经营数据图表" />;
}
