export type TaskType = 'deep-work' | 'admin' | 'study' | 'meeting' | 'creative' | 'other';

export type CognitiveState = 'deep-focus' | 'shallow-work' | 'fatigue' | 'peak-performance';

export interface BehaviorSignalSnapshot {
  timestamp: string;
  taskId?: string;
  taskType?: TaskType;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  completionStatus?: 'completed' | 'partial' | 'not-started';
  completionMinutes?: number;
  expectedMinutes?: number;
  appSwitches?: number;
  idleMinutes?: number;
  typingActivity?: number;
  mouseActivity?: number;
  sessionMinutes?: number;
  streakDays?: number;
  moodRating?: number;
  energyRating?: number;
  focusRating?: number;
  breakCount?: number;
  interruptions?: number;
  delayCount?: number;
  wasRescheduled?: boolean;
  distractingAppOpenCount?: number;
}

export interface CognitiveStateResult {
  state: CognitiveState;
  confidence: number;
  focusScore: number;
  fatigueScore: number;
  shallowScore: number;
  evidence: string[];
}

export interface PeakWindow {
  startHour: number;
  endHour: number;
  averageCompletionVelocity: number;
  samples: number;
}

export interface ScheduleBlock {
  id: string;
  taskId?: string;
  taskType: TaskType;
  startHour: number;
  endHour: number;
  dayKey: string;
}

export interface ScheduleAdaptation {
  blockId: string;
  originalStartHour: number;
  updatedStartHour: number;
  originalEndHour: number;
  updatedEndHour: number;
  reason: string;
}

export interface ScheduleEvolutionResult {
  adaptations: ScheduleAdaptation[];
  updatedSchedule: ScheduleBlock[];
  insights: string[];
}

export type BehavioralLoopType =
  | 'distraction-loop'
  | 'avoidance-loop'
  | 'fragmentation-loop'
  | 'overplanning-loop';

export interface BehavioralLoopSignal {
  type: BehavioralLoopType;
  severity: 'low' | 'medium' | 'high';
  occurrences: number;
  description: string;
}

export interface IdealProductivityModel {
  bestFocusWindows: PeakWindow[];
  idealBreakIntervalMinutes: number;
  bestTaskOrder: TaskType[];
  idealDailyCapacityMinutes: number;
}

export interface ActualProductivityModel {
  completionRate: number;
  averageInterruptionsPerSession: number;
  averageStartDelayMinutes: number;
  fatigueStartHour: number;
}

export interface DigitalTwinResult {
  ideal: IdealProductivityModel;
  actual: ActualProductivityModel;
  gapScore: number;
  tomorrowBestWindow?: PeakWindow;
  overloadRisk: 'low' | 'medium' | 'high';
  procrastinationRisk: 'low' | 'medium' | 'high';
  forecastMessage: string;
}

export interface BehaviorIntelligenceOutput {
  cognitiveState: CognitiveStateResult;
  scheduleEvolution: ScheduleEvolutionResult;
  loops: BehavioralLoopSignal[];
  digitalTwin: DigitalTwinResult;
}
