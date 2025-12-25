import { average, percentile } from "./math";

export function calculateStats(data: any[]) {
  const metrics = ["LCP", "FID", "CLS", "FCP", "TTFB"];
  const stats: Record<string, any> = {};

  for (const metricName of metrics) {
    const metricData = data.filter((d) => d.metric_name === metricName);

    if (metricData.length === 0) {
      stats[metricName] = {
        count: 0,
        avg: 0,
        p50: 0,
        p75: 0,
        p95: 0,
        good: 0,
        needsImprovement: 0,
        poor: 0,
      };
      continue;
    }

    const values = metricData.map((d) => Number(d.metric_value)).sort((a, b) => a - b);

    stats[metricName] = {
      count: metricData.length,
      avg: average(values),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p95: percentile(values, 0.95),
      p99: percentile(values, 0.99),
      min: values[0],
      max: values[values.length - 1],
      good: metricData.filter((d) => d.metric_rating === "good").length,
      needsImprovement: metricData.filter((d) => d.metric_rating === "needs-improvement").length,
      poor: metricData.filter((d) => d.metric_rating === "poor").length,
      goodPercentage: (
        (metricData.filter((d) => d.metric_rating === "good").length / metricData.length) *
        100
      ).toFixed(2),
    };
  }

  return stats;
}

export function calculatePageStats(data: any[]) {
  const pages: Record<string, any> = {};

  for (const item of data) {
    const path = item.page_path || "/";

    if (!pages[path]) {
      pages[path] = { path, count: 0, metrics: {} };
    }

    pages[path].count++;

    if (!pages[path].metrics[item.metric_name]) {
      pages[path].metrics[item.metric_name] = [];
    }

    pages[path].metrics[item.metric_name].push(Number(item.metric_value));
  }

  const pageStatsArray = Object.values(pages).map((page: any) => {
    const avgMetrics: Record<string, number> = {};
    for (const [metric, values] of Object.entries(page.metrics)) {
      avgMetrics[metric] = average(values as number[]);
    }
    return { path: page.path, count: page.count, avgMetrics };
  });

  return pageStatsArray.sort((a, b) => b.count - a.count).slice(0, 20);
}

export function calculateDeviceStats(data: any[]) {
  const devices: Record<string, any> = { mobile: [], tablet: [], desktop: [], unknown: [] };

  for (const item of data) {
    const deviceType = item.device_type || "unknown";
    if (devices[deviceType]) devices[deviceType].push(item);
  }

  const deviceStatsArray = Object.entries(devices).map(([device, items]) => {
    const metricValues = (items as any[]).map((item: any) => Number(item.metric_value));
    return {
      device,
      count: (items as any[]).length,
      avgValue: metricValues.length > 0 ? average(metricValues) : 0,
      p75:
        metricValues.length > 0
          ? percentile(
              metricValues.sort((a: number, b: number) => a - b),
              0.75
            )
          : 0,
    };
  });

  return deviceStatsArray.filter((d) => d.count > 0);
}
