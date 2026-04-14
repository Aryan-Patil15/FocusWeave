export const FOCUS_AUDITOR_PLAN_TYPES = [
  'focus',
  'study',
  'work',
  'rest',
  'sleep',
  'social',
  'exercise',
  'meal',
  'admin',
  'personal',
] as const;

export const FOCUS_AUDITOR_ACTIVITY_TYPES = [
  ...FOCUS_AUDITOR_PLAN_TYPES,
  'meeting',
  'commute',
  'chores',
  'idle',
  'unlogged',
] as const;

export type FocusPlanType = (typeof FOCUS_AUDITOR_PLAN_TYPES)[number];
export type FocusActivityType = (typeof FOCUS_AUDITOR_ACTIVITY_TYPES)[number];

export interface FocusPlanBlock {
  id: string;
  label?: string;
  type: FocusPlanType;
  startMinute: number;
  endMinute: number;
}

export interface FocusActivityLogEntry {
  id: string;
  timestamp: string;
  duration: number;
  activity: FocusActivityType;
  notes?: string;
}

export interface FocusTimelineSegment {
  startMinute: number;
  endMinute: number;
  type: FocusActivityType | FocusPlanType;
  label: string;
  minutes: number;
}

export interface FocusDeviation {
  id: string;
  startMinute: number;
  endMinute: number;
  duration: number;
  expected: FocusPlanType;
  actual: FocusActivityType;
  penaltyPerMinute: number;
  pointImpact: number;
  summary: string;
}

export interface FocusCategoryBreakdown {
  type: FocusPlanType;
  label: string;
  trackedMinutes: number;
  earnedPoints: number;
  maxPoints: number;
  alignment: number;
}

export interface FocusAuditResult {
  alignmentScore: number;
  trackedMinutes: number;
  earnedPoints: number;
  maxPoints: number;
  categoryBreakdown: FocusCategoryBreakdown[];
  deviations: FocusDeviation[];
  topDeviations: FocusDeviation[];
  planTimeline: FocusTimelineSegment[];
  actualTimeline: FocusTimelineSegment[];
  generatedAt: string;
  insights: string[];
}
