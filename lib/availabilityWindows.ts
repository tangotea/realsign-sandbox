type Window = { weekday: number; start_time: string; end_time: string; active: boolean };

export function mergedAvailability(rules: Window[], weekday: number) {
  const sorted = rules.filter(rule => rule.active && rule.weekday === weekday)
    .map(rule => ({ start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5) }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const result: { start_time: string; end_time: string }[] = [];
  for (const window of sorted) {
    const last = result[result.length - 1];
    if (last && window.start_time <= last.end_time) {
      if (window.end_time > last.end_time) last.end_time = window.end_time;
    } else result.push({ ...window });
  }
  return result;
}

export function overlapsAvailability(rules: Window[], weekdays: number[], start: string, end: string) {
  return rules.some(rule => weekdays.includes(rule.weekday) &&
    start < rule.end_time.slice(0, 5) && end > rule.start_time.slice(0, 5));
}
