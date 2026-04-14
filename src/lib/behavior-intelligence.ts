import type {
  ActualProductivityModel,
  BehaviorIntelligenceOutput,
  BehavioralLoopSignal,
  BehaviorSignalSnapshot,
  CognitiveStateResult,
  DigitalTwinResult,
  IdealProductivityModel,
  PeakWindow,
  ScheduleAdaptation,
  ScheduleBlock,
  ScheduleEvolutionResult,
  TaskType,
} from '@/types/behavior-intelligence';

const MIN_WINDOW_SAMPLES = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toHour(isoLike?: string): number | null {
  if (!isoLike) return null;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
}

function safeAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function completionVelocity(signal: BehaviorSignalSnapshot): number {
  if (!signal.completionMinutes || !signal.expectedMinutes || signal.expectedMinutes <= 0) {
    return 0;
  }
  return signal.expectedMinutes / signal.completionMinutes;
}

export function detectCognitiveState(signals: BehaviorSignalSnapshot[]): CognitiveStateResult {
  if (signals.length === 0) {
    return {
      state: 'shallow-work',
      confidence: 0.2,
      focusScore: 0,
      fatigueScore: 0,
      shallowScore: 0,
      evidence: ['No behavior data yet.'],
    };
  }

  const avgSession = safeAverage(signals.map((s) => s.sessionMinutes ?? 0));
  const avgSwitching = safeAverage(signals.map((s) => s.appSwitches ?? 0));
  const avgProgressVelocity = safeAverage(signals.map(completionVelocity));
  const avgIdle = safeAverage(signals.map((s) => s.idleMinutes ?? 0));
  const avgBreaks = safeAverage(signals.map((s) => s.breakCount ?? 0));
  const avgEnergy = safeAverage(signals.map((s) => s.energyRating ?? 5));
  const lateHours = signals.filter((s) => {
    const hour = toHour(s.actualEnd ?? s.timestamp);
    return hour !== null && hour >= 21;
  }).length;

  const focusScore = clamp(
    avgSession * 0.04 + (1 / (1 + avgSwitching)) * 25 + avgProgressVelocity * 35 + (10 - avgIdle) * 1.8,
    0,
    100
  );

  const fatigueScore = clamp(
    avgIdle * 3 + avgBreaks * 8 + (10 - avgEnergy) * 5 + lateHours * 4 + (1 - avgProgressVelocity) * 30,
    0,
    100
  );

  const shallowScore = clamp(
    avgSwitching * 7 + (avgSession < 30 ? 20 : 0) + (1 - avgProgressVelocity) * 20,
    0,
    100
  );

  const evidence: string[] = [];
  if (avgSession >= 60) evidence.push('Long uninterrupted work sessions detected.');
  if (avgSwitching <= 3) evidence.push('Low app switching during sessions.');
  if (avgProgressVelocity >= 1) evidence.push('Task completion speed is at or above expectation.');
  if (avgBreaks >= 3 || avgIdle >= 10) evidence.push('Frequent breaks and idle time were detected.');
  if (lateHours > 0) evidence.push('Late-hour sessions are correlated with weaker performance.');

  let state: CognitiveStateResult['state'] = 'shallow-work';
  if (focusScore >= 70 && fatigueScore < 45) {
    state = 'deep-focus';
  } else if (fatigueScore >= 60) {
    state = 'fatigue';
  } else if (focusScore >= 60 && fatigueScore < 40) {
    state = 'peak-performance';
  }

  const confidence = clamp(Math.max(focusScore, fatigueScore, shallowScore) / 100, 0.2, 0.95);

  return {
    state,
    confidence,
    focusScore: Number(focusScore.toFixed(1)),
    fatigueScore: Number(fatigueScore.toFixed(1)),
    shallowScore: Number(shallowScore.toFixed(1)),
    evidence,
  };
}

export function detectPeakPerformanceWindows(signals: BehaviorSignalSnapshot[]): PeakWindow[] {
  const bucketed = new Map<number, number[]>();

  for (const signal of signals) {
    const startHour = toHour(signal.actualStart ?? signal.timestamp);
    if (startHour === null) continue;
    const velocity = completionVelocity(signal);
    if (!bucketed.has(startHour)) bucketed.set(startHour, []);
    bucketed.get(startHour)?.push(velocity);
  }

  return [...bucketed.entries()]
    .filter(([, samples]) => samples.length >= MIN_WINDOW_SAMPLES)
    .map(([hour, samples]) => ({
      startHour: hour,
      endHour: (hour + 2) % 24,
      averageCompletionVelocity: Number(safeAverage(samples).toFixed(2)),
      samples: samples.length,
    }))
    .sort((a, b) => b.averageCompletionVelocity - a.averageCompletionVelocity)
    .slice(0, 3);
}

export function evolveSchedule(
  plannedSchedule: ScheduleBlock[],
  signals: BehaviorSignalSnapshot[],
  peakWindows: PeakWindow[]
): ScheduleEvolutionResult {
  const adaptations: ScheduleAdaptation[] = [];
  const updatedSchedule = plannedSchedule.map((block) => ({ ...block }));
  const insights: string[] = [];

  for (const block of updatedSchedule) {
    const relatedSignals = signals.filter((signal) => signal.taskId && signal.taskId === block.taskId);
    const repeatedDelays = relatedSignals.filter((signal) => (signal.delayCount ?? 0) >= 1).length;

    const matchedPeakWindow = peakWindows.find((window) => {
      const blockInWindow = block.startHour >= window.startHour && block.startHour < window.endHour;
      return blockInWindow;
    });

    if (repeatedDelays >= 3 && peakWindows[0]) {
      const bestWindow = peakWindows[0];
      const duration = Math.max(1, block.endHour - block.startHour);
      adaptations.push({
        blockId: block.id,
        originalStartHour: block.startHour,
        originalEndHour: block.endHour,
        updatedStartHour: bestWindow.startHour,
        updatedEndHour: (bestWindow.startHour + duration) % 24,
        reason: 'Task postponed repeatedly in current slot; moved to historically stronger execution window.',
      });
      block.startHour = bestWindow.startHour;
      block.endHour = (bestWindow.startHour + duration) % 24;
      continue;
    }

    if (block.taskType === 'deep-work' && !matchedPeakWindow && peakWindows[0]) {
      const duration = Math.max(1, block.endHour - block.startHour);
      adaptations.push({
        blockId: block.id,
        originalStartHour: block.startHour,
        originalEndHour: block.endHour,
        updatedStartHour: peakWindows[0].startHour,
        updatedEndHour: (peakWindows[0].startHour + duration) % 24,
        reason: 'Deep work moved into top focus period.',
      });
      block.startHour = peakWindows[0].startHour;
      block.endHour = (peakWindows[0].startHour + duration) % 24;
      continue;
    }

    if (block.taskType === 'admin' && peakWindows[0] && block.startHour === peakWindows[0].startHour) {
      const lowEnergyTarget = clamp(peakWindows[0].startHour + 4, 0, 23);
      adaptations.push({
        blockId: block.id,
        originalStartHour: block.startHour,
        originalEndHour: block.endHour,
        updatedStartHour: lowEnergyTarget,
        updatedEndHour: (lowEnergyTarget + Math.max(1, block.endHour - block.startHour)) % 24,
        reason: 'Admin task shifted out of prime focus hours.',
      });
      block.startHour = lowEnergyTarget;
      block.endHour = (lowEnergyTarget + Math.max(1, block.endHour - block.startHour)) % 24;
    }
  }

  if (adaptations.length > 0) {
    insights.push(`Adjusted ${adaptations.length} schedule block(s) using the last behavior cycle.`);
  }

  const highInterruptionHour = detectHighInterruptionHour(signals);
  if (highInterruptionHour !== null) {
    insights.push(`Avoid assigning deep work around ${String(highInterruptionHour).padStart(2, '0')}:00 due to interruptions.`);
  }

  return { adaptations, updatedSchedule, insights };
}

function detectHighInterruptionHour(signals: BehaviorSignalSnapshot[]): number | null {
  const map = new Map<number, number[]>();
  for (const signal of signals) {
    const hour = toHour(signal.actualStart ?? signal.timestamp);
    if (hour === null) continue;
    if (!map.has(hour)) map.set(hour, []);
    map.get(hour)?.push(signal.interruptions ?? 0);
  }

  let bestHour: number | null = null;
  let highest = 0;
  for (const [hour, values] of map.entries()) {
    const avg = safeAverage(values);
    if (avg > highest) {
      highest = avg;
      bestHour = hour;
    }
  }

  return highest >= 3 ? bestHour : null;
}

export function detectBehavioralLoops(signals: BehaviorSignalSnapshot[]): BehavioralLoopSignal[] {
  const loops: BehavioralLoopSignal[] = [];

  const distractionEvents = signals.filter((s) => (s.distractingAppOpenCount ?? 0) > 0);
  if (distractionEvents.length >= 3) {
    loops.push({
      type: 'distraction-loop',
      severity: distractionEvents.length >= 8 ? 'high' : 'medium',
      occurrences: distractionEvents.length,
      description: 'Repeated distracting app usage detected in work blocks.',
    });
  }

  const avoidanceEvents = signals.filter((s) => (s.wasRescheduled || (s.delayCount ?? 0) > 0) && s.taskType === 'deep-work');
  if (avoidanceEvents.length >= 3) {
    loops.push({
      type: 'avoidance-loop',
      severity: avoidanceEvents.length >= 6 ? 'high' : 'medium',
      occurrences: avoidanceEvents.length,
      description: 'High-value tasks are being repeatedly postponed.',
    });
  }

  const fragmentedSessions = signals.filter((s) => (s.appSwitches ?? 0) >= 8 && (s.completionStatus ?? 'not-started') !== 'completed');
  if (fragmentedSessions.length >= 4) {
    loops.push({
      type: 'fragmentation-loop',
      severity: fragmentedSessions.length >= 8 ? 'high' : 'medium',
      occurrences: fragmentedSessions.length,
      description: 'Frequent task switching with low completion is creating fragmented work.',
    });
  }

  const overplanningEvents = signals.filter((s) => (s.delayCount ?? 0) >= 2 && (s.completionStatus ?? 'not-started') === 'not-started');
  if (overplanningEvents.length >= 4) {
    loops.push({
      type: 'overplanning-loop',
      severity: overplanningEvents.length >= 7 ? 'high' : 'low',
      occurrences: overplanningEvents.length,
      description: 'Planning volume is outpacing execution.',
    });
  }

  return loops;
}

export function buildDigitalTwin(signals: BehaviorSignalSnapshot[], peakWindows: PeakWindow[]): DigitalTwinResult {
  const ideal: IdealProductivityModel = {
    bestFocusWindows: peakWindows,
    idealBreakIntervalMinutes: 90,
    bestTaskOrder: ['deep-work', 'study', 'creative', 'admin', 'meeting'],
    idealDailyCapacityMinutes: 360,
  };

  const completionRate =
    signals.length === 0
      ? 0
      : signals.filter((signal) => signal.completionStatus === 'completed').length / signals.length;

  const actual: ActualProductivityModel = {
    completionRate: Number((completionRate * 100).toFixed(1)),
    averageInterruptionsPerSession: Number(safeAverage(signals.map((signal) => signal.interruptions ?? 0)).toFixed(1)),
    averageStartDelayMinutes: Number(safeAverage(signals.map((signal) => (signal.delayCount ?? 0) * 10)).toFixed(1)),
    fatigueStartHour: detectFatigueStartHour(signals),
  };

  const focusGap = peakWindows[0] ? Math.abs(peakWindows[0].startHour - estimateActualStartHour(signals, 'deep-work')) : 0;
  const completionGap = Math.max(0, 85 - actual.completionRate);
  const interruptionGap = actual.averageInterruptionsPerSession * 4;
  const gapScore = clamp(Number((focusGap * 8 + completionGap + interruptionGap).toFixed(1)), 0, 100);

  const overloadRisk = actual.averageInterruptionsPerSession >= 4 || actual.fatigueStartHour <= 15 ? 'high' : actual.averageInterruptionsPerSession >= 2 ? 'medium' : 'low';
  const procrastinationRisk = actual.averageStartDelayMinutes >= 25 || actual.completionRate < 60 ? 'high' : actual.averageStartDelayMinutes >= 10 ? 'medium' : 'low';

  const tomorrowBestWindow = peakWindows[0];
  const forecastMessage =
    tomorrowBestWindow
      ? `Your best predicted deep-work window tomorrow is ${String(tomorrowBestWindow.startHour).padStart(2, '0')}:00-${String(tomorrowBestWindow.endHour).padStart(2, '0')}:00.`
      : 'Collect more task telemetry to generate tomorrow\'s work-window prediction.';

  return {
    ideal,
    actual,
    gapScore,
    tomorrowBestWindow,
    overloadRisk,
    procrastinationRisk,
    forecastMessage,
  };
}

function detectFatigueStartHour(signals: BehaviorSignalSnapshot[]): number {
  const byHour = new Map<number, number[]>();
  for (const signal of signals) {
    const hour = toHour(signal.actualStart ?? signal.timestamp);
    if (hour === null) continue;
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)?.push(signal.energyRating ?? 5);
  }

  let detected = 17;
  let minEnergy = Infinity;
  for (const [hour, ratings] of byHour.entries()) {
    const avg = safeAverage(ratings);
    if (avg < minEnergy) {
      minEnergy = avg;
      detected = hour;
    }
  }

  return detected;
}

function estimateActualStartHour(signals: BehaviorSignalSnapshot[], taskType: TaskType): number {
  const filtered = signals.filter((s) => s.taskType === taskType).map((s) => toHour(s.actualStart ?? s.timestamp)).filter((hour): hour is number => hour !== null);
  if (filtered.length === 0) return 9;
  return Math.round(safeAverage(filtered));
}

export function runBehaviorIntelligence(
  plannedSchedule: ScheduleBlock[],
  signals: BehaviorSignalSnapshot[]
): BehaviorIntelligenceOutput {
  const cognitiveState = detectCognitiveState(signals);
  const peakWindows = detectPeakPerformanceWindows(signals);
  const scheduleEvolution = evolveSchedule(plannedSchedule, signals, peakWindows);
  const loops = detectBehavioralLoops(signals);
  const digitalTwin = buildDigitalTwin(signals, peakWindows);

  return {
    cognitiveState,
    scheduleEvolution,
    loops,
    digitalTwin,
  };
}
