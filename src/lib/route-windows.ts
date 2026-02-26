export interface RouteWindowOption {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  active: boolean;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function parseTime(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw || 0);
  const minute = Number(minuteRaw || 0);
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

export function getNextWindowOccurrence(window: RouteWindowOption, baseDate = new Date()): Date {
  const candidate = new Date(baseDate);
  const dayDiff = (window.weekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + dayDiff);

  const { hour, minute } = parseTime(window.start_time);
  candidate.setHours(hour, minute, 0, 0);

  if (dayDiff === 0 && candidate.getTime() <= baseDate.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

export function formatWindowLabel(window: RouteWindowOption): string {
  const dayLabel = DAY_LABELS[window.weekday] || `Dia ${window.weekday}`;
  const start = window.start_time.slice(0, 5);
  const end = window.end_time.slice(0, 5);
  return `${dayLabel} ${start}-${end}`;
}
