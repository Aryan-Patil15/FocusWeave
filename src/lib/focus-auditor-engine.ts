import { parseISO, isValid } from 'date-fns';
import type {
  FocusActivityLogEntry,
  FocusActivityType,
  FocusAuditResult,
  FocusCategoryBreakdown,
  FocusDeviation,
  FocusPlanBlock,
  FocusPlanType,
  FocusTimelineSegment,
} from '@/types/focus-auditor';

const MINUTES_PER_DAY = 24 * 60;

export const FOCUS_AUDITOR_LABELS: Record<FocusPlanType | FocusActivityType, string> = {
  focus: 'Focus',
  study: 'Study',
  work: 'Work',
  rest: 'Rest',
  sleep: 'Sleep',
  social: 'Social',
  exercise: 'Exercise',
  meal: 'Meal',
  admin: 'Admin',
  personal: 'Personal',
  meeting: 'Meeting',
  commute: 'Commute',
  chores: 'Chores',
  idle: 'Idle',
  unlogged: 'Unlogged',
};

export const FOCUS_AUDITOR_COLORS: Record<FocusPlanType | FocusActivityType, string> = {
  focus: '#22c55e',
  study: '#3b82f6',
  work: '#06b6d4',
  rest: '#f59e0b',
  sleep: '#6366f1',
  social: '#ec4899',
  exercise: '#ef4444',
  meal: '#f97316',
  admin: '#8b5cf6',
  personal: '#14b8a6',
  meeting: '#0ea5e9',
  commute: '#64748b',
  chores: '#84cc16',
  idle: '#94a3b8',
  unlogged: '#cbd5e1',
};

const COMPATIBILITY_MATRIX: Record<FocusPlanType, FocusActivityType[]> = {
  focus: ['focus', 'study', 'work'],
  study: ['study', 'focus', 'work'],
  work: ['work', 'focus', 'meeting', 'admin'],
  rest: ['rest', 'meal', 'personal'],
  sleep: ['sleep'],
  social: ['social', 'personal'],
  exercise: ['exercise'],
  meal: ['meal', 'rest'],
  admin: ['admin', 'work', 'meeting'],
  personal: ['personal', 'social', 'chores', 'commute'],
};

export function minuteToTimeLabel(minute: number): string {
  const normalizedMinute = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalizedMinute / 60);
  const minutes = normalizedMinute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeLabelToMinute(value: string): number {
  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return 0;
  }

  return hours * 60 + minutes;
}

function getMinuteOfDay(timestamp: string): number | null {
  const timeOnlyMatch = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(timestamp.trim());
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = Number(timeOnlyMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes;
    }
  }

  const parsed = parseISO(timestamp);
  if (!isValid(parsed)) {
    return null;
  }

  return parsed.getHours() * 60 + parsed.getMinutes();
}

function setRange<T>(target: T[], startMinute: number, endMinute: number, value: T): void {
  if (startMinute === endMinute) {
    return;
  }

  if (startMinute < endMinute) {
    for (let minute = startMinute; minute < endMinute; minute += 1) {
      target[minute] = value;
    }
    return;
  }

  for (let minute = startMinute; minute < MINUTES_PER_DAY; minute += 1) {
    target[minute] = value;
  }

  for (let minute = 0; minute < endMinute; minute += 1) {
    target[minute] = value;
  }
}

function compactMinuteMap<T extends FocusActivityType | FocusPlanType>(
  minuteMap: Array<T | null>,
  fallbackType?: T
): FocusTimelineSegment[] {
  const segments: FocusTimelineSegment[] = [];
  let segmentStart = 0;
  let currentType = minuteMap[0] ?? fallbackType ?? null;

  for (let minute = 1; minute <= MINUTES_PER_DAY; minute += 1) {
    const typeAtMinute = minute < MINUTES_PER_DAY ? minuteMap[minute] ?? fallbackType ?? null : null;
    if (typeAtMinute === currentType) {
      continue;
    }

    if (currentType) {
      segments.push({
        startMinute: segmentStart,
        endMinute: minute,
        type: currentType,
        label: FOCUS_AUDITOR_LABELS[currentType],
        minutes: minute - segmentStart,
      });
    }

    segmentStart = minute;
    currentType = typeAtMinute;
  }

  return segments;
}

function getPenaltyPerMinute(expected: FocusPlanType, actual: FocusActivityType): number {
  if (COMPATIBILITY_MATRIX[expected].includes(actual)) {
    return 0;
  }

  if ((expected === 'focus' || expected === 'study') && actual === 'social') return 1;
  if ((expected === 'focus' || expected === 'study') && actual === 'idle') return 0.5;
  if ((expected === 'focus' || expected === 'study') && actual === 'unlogged') return 0.45;
  if ((expected === 'focus' || expected === 'study') && actual === 'meeting') return 0.35;
  if ((expected === 'focus' || expected === 'study') && actual === 'commute') return 0.55;
  if ((expected === 'focus' || expected === 'study') && actual === 'sleep') return 0.8;
  if (expected === 'sleep' && actual !== 'sleep') return actual === 'rest' ? 0.35 : 0.9;
  if (expected === 'exercise' && actual === 'sleep') return 0.7;
  if (expected === 'exercise' && actual === 'idle') return 0.45;
  if (expected === 'rest' && (actual === 'work' || actual === 'study' || actual === 'focus')) return 0.4;
  if (expected === 'social' && (actual === 'work' || actual === 'study' || actual === 'focus')) return 0.55;
  if (expected === 'meal' && actual === 'unlogged') return 0.3;
  if (expected === 'work' && actual === 'social') return 0.85;
  if (expected === 'work' && actual === 'unlogged') return 0.4;
  if (expected === 'admin' && actual === 'social') return 0.55;
  if (expected === 'personal' && actual === 'work') return 0.35;

  if (actual === 'unlogged') return 0.3;
  if (actual === 'idle') return 0.35;
  return 0.6;
}

function buildDeviationSummary(expected: FocusPlanType, actual: FocusActivityType, startMinute: number, endMinute: number): string {
  return `${minuteToTimeLabel(startMinute)}-${minuteToTimeLabel(endMinute)}: ${FOCUS_AUDITOR_LABELS[actual]} during ${FOCUS_AUDITOR_LABELS[expected]}`;
}

export function validateFocusPlanBlocks(blocks: FocusPlanBlock[]): string[] {
  const errors: string[] = [];

  if (blocks.length === 0) {
    errors.push('Add at least one planned block before running an audit.');
  }

  const minuteMap = Array<FocusPlanType | null>(MINUTES_PER_DAY).fill(null);

  for (const block of blocks) {
    if (block.startMinute === block.endMinute) {
      errors.push(`"${block.label || FOCUS_AUDITOR_LABELS[block.type]}" has the same start and end time.`);
      continue;
    }

    const minutesToVisit: number[] = [];
    if (block.startMinute < block.endMinute) {
      for (let minute = block.startMinute; minute < block.endMinute; minute += 1) {
        minutesToVisit.push(minute);
      }
    } else {
      for (let minute = block.startMinute; minute < MINUTES_PER_DAY; minute += 1) {
        minutesToVisit.push(minute);
      }
      for (let minute = 0; minute < block.endMinute; minute += 1) {
        minutesToVisit.push(minute);
      }
    }

    for (const minute of minutesToVisit) {
      if (minuteMap[minute]) {
        errors.push('Plan blocks overlap. Adjust the time ranges so each planned minute belongs to only one block.');
        return errors;
      }
      minuteMap[minute] = block.type;
    }
  }

  return errors;
}

export function validateActivityLogs(entries: FocusActivityLogEntry[]): string[] {
  const errors: string[] = [];

  if (entries.length === 0) {
    errors.push('Import at least one activity log entry.');
  }

  if (entries.length > 200) {
    errors.push('Activity logs are limited to 200 entries per audit.');
  }

  entries.forEach((entry, index) => {
    const minuteOfDay = getMinuteOfDay(entry.timestamp);
    if (minuteOfDay === null) {
      errors.push(`Entry ${index + 1} has an invalid timestamp. Use ISO 8601 or HH:mm.`);
    }
    if (!Number.isFinite(entry.duration) || entry.duration < 1 || entry.duration > 120) {
      errors.push(`Entry ${index + 1} has an invalid duration. Use 1 to 120 minutes.`);
    }
  });

  return errors;
}

export function parseActivityLogJson(rawJson: string): { entries: FocusActivityLogEntry[]; errors: string[] } {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) {
      return { entries: [], errors: ['Activity log JSON must be an array of entries.'] };
    }

    const entries = parsed.map((item, index) => {
      const record = item as Record<string, unknown>;
      const activity = typeof record.activity === 'string' ? record.activity : 'unlogged';
      return {
        id: typeof record.id === 'string' ? record.id : `log-${Date.now()}-${index}`,
        timestamp: typeof record.timestamp === 'string' ? record.timestamp : '',
        duration: typeof record.duration === 'number' ? record.duration : Number(record.duration ?? 0),
        activity: activity as FocusActivityType,
        notes: typeof record.notes === 'string' ? record.notes : undefined,
      };
    });

    const invalidActivity = entries.find((entry) => !(entry.activity in FOCUS_AUDITOR_LABELS));
    if (invalidActivity) {
      return { entries: [], errors: [`Unsupported activity type "${invalidActivity.activity}".`] };
    }

    return { entries, errors: validateActivityLogs(entries) };
  } catch (error) {
    return {
      entries: [],
      errors: [error instanceof Error ? error.message : 'Invalid JSON input.'],
    };
  }
}

export function buildPlanMinuteMap(blocks: FocusPlanBlock[]): Array<FocusPlanType | null> {
  const minuteMap = Array<FocusPlanType | null>(MINUTES_PER_DAY).fill(null);
  blocks.forEach((block) => {
    setRange(minuteMap, block.startMinute, block.endMinute, block.type);
  });
  return minuteMap;
}

export function buildActualMinuteMap(entries: FocusActivityLogEntry[]): Array<FocusActivityType | null> {
  const minuteMap = Array<FocusActivityType | null>(MINUTES_PER_DAY).fill(null);

  entries.forEach((entry) => {
    const startMinute = getMinuteOfDay(entry.timestamp);
    if (startMinute === null) {
      return;
    }

    const endMinute = (startMinute + Math.round(entry.duration)) % MINUTES_PER_DAY;
    setRange(minuteMap, startMinute, endMinute, entry.activity);
  });

  return minuteMap;
}

export function buildPlanTimeline(blocks: FocusPlanBlock[]): FocusTimelineSegment[] {
  return compactMinuteMap(buildPlanMinuteMap(blocks));
}

export function buildActualTimeline(entries: FocusActivityLogEntry[]): FocusTimelineSegment[] {
  if (entries.length === 0) {
    return [];
  }
  return compactMinuteMap(buildActualMinuteMap(entries), 'unlogged');
}

export function buildFocusAuditResult(blocks: FocusPlanBlock[], entries: FocusActivityLogEntry[]): FocusAuditResult {
  const planMinuteMap = buildPlanMinuteMap(blocks);
  const actualMinuteMap = buildActualMinuteMap(entries);

  const categoryAccumulator = new Map<FocusPlanType, FocusCategoryBreakdown>();
  const deviations: FocusDeviation[] = [];

  let trackedMinutes = 0;
  let earnedPoints = 0;
  let deviationStart: number | null = null;
  let deviationExpected: FocusPlanType | null = null;
  let deviationActual: FocusActivityType | null = null;
  let deviationPenalty = 0;

  for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
    const expected = planMinuteMap[minute];
    if (!expected) {
      continue;
    }

    const actual = actualMinuteMap[minute] ?? 'unlogged';
    const penalty = getPenaltyPerMinute(expected, actual);
    const minuteScore = Math.max(0, 1 - penalty);

    trackedMinutes += 1;
    earnedPoints += minuteScore;

    const existing = categoryAccumulator.get(expected);
    if (existing) {
      existing.trackedMinutes += 1;
      existing.maxPoints += 1;
      existing.earnedPoints += minuteScore;
    } else {
      categoryAccumulator.set(expected, {
        type: expected,
        label: FOCUS_AUDITOR_LABELS[expected],
        trackedMinutes: 1,
        maxPoints: 1,
        earnedPoints: minuteScore,
        alignment: 0,
      });
    }

    if (penalty > 0) {
      if (
        deviationStart === null ||
        deviationExpected !== expected ||
        deviationActual !== actual ||
        deviationPenalty !== penalty
      ) {
        if (deviationStart !== null && deviationExpected && deviationActual) {
          const duration = minute - deviationStart;
          deviations.push({
            id: `dev-${deviationStart}-${minute}`,
            startMinute: deviationStart,
            endMinute: minute,
            duration,
            expected: deviationExpected,
            actual: deviationActual,
            penaltyPerMinute: deviationPenalty,
            pointImpact: Number((duration * deviationPenalty).toFixed(2)),
            summary: buildDeviationSummary(deviationExpected, deviationActual, deviationStart, minute),
          });
        }

        deviationStart = minute;
        deviationExpected = expected;
        deviationActual = actual;
        deviationPenalty = penalty;
      }
    } else if (deviationStart !== null && deviationExpected && deviationActual) {
      const duration = minute - deviationStart;
      deviations.push({
        id: `dev-${deviationStart}-${minute}`,
        startMinute: deviationStart,
        endMinute: minute,
        duration,
        expected: deviationExpected,
        actual: deviationActual,
        penaltyPerMinute: deviationPenalty,
        pointImpact: Number((duration * deviationPenalty).toFixed(2)),
        summary: buildDeviationSummary(deviationExpected, deviationActual, deviationStart, minute),
      });
      deviationStart = null;
      deviationExpected = null;
      deviationActual = null;
      deviationPenalty = 0;
    }
  }

  if (deviationStart !== null && deviationExpected && deviationActual) {
    const duration = MINUTES_PER_DAY - deviationStart;
    deviations.push({
      id: `dev-${deviationStart}-${MINUTES_PER_DAY}`,
      startMinute: deviationStart,
      endMinute: MINUTES_PER_DAY,
      duration,
      expected: deviationExpected,
      actual: deviationActual,
      penaltyPerMinute: deviationPenalty,
      pointImpact: Number((duration * deviationPenalty).toFixed(2)),
      summary: buildDeviationSummary(deviationExpected, deviationActual, deviationStart, MINUTES_PER_DAY),
    });
  }

  const categoryBreakdown = Array.from(categoryAccumulator.values())
    .map((item) => ({
      ...item,
      alignment: item.maxPoints === 0 ? 0 : Math.round((item.earnedPoints / item.maxPoints) * 100),
    }))
    .sort((a, b) => b.trackedMinutes - a.trackedMinutes);

  const alignmentScore = trackedMinutes === 0 ? 0 : Math.round((earnedPoints / trackedMinutes) * 100);

  return {
    alignmentScore,
    trackedMinutes,
    earnedPoints: Number(earnedPoints.toFixed(2)),
    maxPoints: trackedMinutes,
    categoryBreakdown,
    deviations,
    topDeviations: [...deviations].sort((a, b) => b.pointImpact - a.pointImpact).slice(0, 6),
    planTimeline: compactMinuteMap(planMinuteMap),
    actualTimeline: compactMinuteMap(actualMinuteMap, 'unlogged'),
    generatedAt: new Date().toISOString(),
    insights: [],
  };
}

export function buildFocusInsightFallback(result: FocusAuditResult): string[] {
  if (result.trackedMinutes === 0) {
    return ['Create a daily plan and import at least one log entry to start auditing your focus rhythm.'];
  }

  const insights: string[] = [];
  const strongest = result.categoryBreakdown[0];
  const weakest = [...result.categoryBreakdown].sort((a, b) => a.alignment - b.alignment)[0];
  const topDeviation = result.topDeviations[0];

  if (result.alignmentScore >= 85) {
    insights.push('Your day stayed closely aligned with the plan. Keep protecting the blocks that are already working.');
  } else if (result.alignmentScore >= 65) {
    insights.push('You followed the plan reasonably well, but a few recurring deviations are still dragging the score down.');
  } else {
    insights.push('The day drifted quite a bit from the plan. Tightening only one or two weak blocks will help more than rebuilding everything.');
  }

  if (weakest) {
    insights.push(`${weakest.label} was your weakest block at ${weakest.alignment}% alignment. Consider shortening or reshaping that block to fit your real energy pattern.`);
  }

  if (topDeviation) {
    insights.push(`${FOCUS_AUDITOR_LABELS[topDeviation.actual]} during ${FOCUS_AUDITOR_LABELS[topDeviation.expected]} caused the biggest penalty. Move that activity closer to a compatible block if possible.`);
  }

  if (strongest && strongest.alignment >= 85) {
    insights.push(`${strongest.label} is a reliable strength for you right now. Anchor important work near that same time of day.`);
  }

  return insights.slice(0, 4);
}

export const focusAuditorSamplePlan: FocusPlanBlock[] = [
  { id: 'sleep', type: 'sleep', label: 'Sleep', startMinute: 22 * 60, endMinute: 6 * 60 },
  { id: 'morning', type: 'personal', label: 'Morning setup', startMinute: 6 * 60, endMinute: 8 * 60 },
  { id: 'deep-work', type: 'focus', label: 'Deep work', startMinute: 8 * 60, endMinute: 11 * 60 },
  { id: 'lunch', type: 'meal', label: 'Lunch', startMinute: 11 * 60, endMinute: 12 * 60 },
  { id: 'study', type: 'study', label: 'Study block', startMinute: 12 * 60, endMinute: 15 * 60 },
  { id: 'reset', type: 'rest', label: 'Reset', startMinute: 15 * 60, endMinute: 16 * 60 },
  { id: 'admin', type: 'admin', label: 'Admin', startMinute: 16 * 60, endMinute: 18 * 60 },
  { id: 'social', type: 'social', label: 'Friends / family', startMinute: 18 * 60, endMinute: 20 * 60 },
  { id: 'wind-down', type: 'rest', label: 'Wind down', startMinute: 20 * 60, endMinute: 22 * 60 },
];

export const focusAuditorSampleLogsJson = JSON.stringify(
  [
    { timestamp: '2026-04-14T06:15:00', duration: 45, activity: 'personal', notes: 'Breakfast and planning' },
    { timestamp: '2026-04-14T08:00:00', duration: 90, activity: 'focus', notes: 'Client deck work' },
    { timestamp: '2026-04-14T09:30:00', duration: 30, activity: 'social', notes: 'Phone scroll' },
    { timestamp: '2026-04-14T10:00:00', duration: 60, activity: 'study', notes: 'Course revision' },
    { timestamp: '2026-04-14T12:15:00', duration: 90, activity: 'study', notes: 'Exam prep' },
    { timestamp: '2026-04-14T14:00:00', duration: 30, activity: 'idle', notes: 'Energy dip' },
    { timestamp: '2026-04-14T16:00:00', duration: 60, activity: 'meeting', notes: 'Status sync' },
    { timestamp: '2026-04-14T18:15:00', duration: 75, activity: 'social', notes: 'Dinner with friends' },
    { timestamp: '2026-04-14T22:30:00', duration: 420, activity: 'sleep', notes: 'Overnight sleep' },
  ],
  null,
  2
);
