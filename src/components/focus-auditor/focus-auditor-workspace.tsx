'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { BarChart as BarChartIcon, BrainCircuit, ClipboardList, Flame, Sparkles, Target, Trophy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTasks } from '@/contexts/tasks-context';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, setDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { handleAuditTaskAlignment } from '@/lib/actions';
import type { AuditTaskAlignmentOutput } from '@/ai/flows/audit-task-alignment';
import {
  buildActualTimeline,
  FOCUS_AUDITOR_LABELS,
  getFocusColor,
  minuteToTimeLabel,
  parseActivityLogJson,
  timeLabelToMinute,
} from '@/lib/focus-auditor-engine';
import {
  loadFocusActivityLogs,
  saveFocusActivityLogs,
} from '@/lib/focus-auditor-storage';
import { FocusClock } from '@/components/focus-auditor/focus-clock';
import type { FocusActivityLogEntry } from '@/types/focus-auditor';
import type { BehaviorSignalSnapshot, TaskType } from '@/types/behavior-intelligence';
import { runBehaviorIntelligence } from '@/lib/behavior-intelligence';

type RewardProfile = {
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  lastRewardDate?: string;
  level: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
};

type AuditDoneTask = {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
};

const REWARD_STORAGE_KEY = 'focusWeave.reward.profile';

function resolveActivityTimestamp(timestamp: string): Date | null {
  const trimmed = timestamp.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  if (/^\d+$/.test(trimmed)) {
    const minuteOfDay = Number(trimmed);
    if (Number.isFinite(minuteOfDay)) {
      const normalizedMinute = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
      const date = new Date();
      date.setHours(Math.floor(normalizedMinute / 60), normalizedMinute % 60, 0, 0);
      return date;
    }
  }

  const timeOnlyMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = Number(timeOnlyMatch[2]);
    const seconds = Number(timeOnlyMatch[3] ?? '0');
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      const date = new Date();
      date.setHours(hours, minutes, seconds, 0);
      return date;
    }
  }

  return null;
}

function getTaskTypeFromTask(taskName: string, taskDescription = ''): TaskType {
  const normalized = `${taskName} ${taskDescription}`.toLowerCase();
  if (normalized.includes('meeting') || normalized.includes('call')) return 'meeting';
  if (normalized.includes('study') || normalized.includes('learn')) return 'study';
  if (normalized.includes('creative') || normalized.includes('design') || normalized.includes('write')) return 'creative';
  if (normalized.includes('admin') || normalized.includes('email') || normalized.includes('report')) return 'admin';
  if (normalized.includes('focus') || normalized.includes('build') || normalized.includes('code')) return 'deep-work';
  return 'other';
}

function getTaskTypeFromActivity(activity: string): TaskType {
  const normalized = activity.toLowerCase();
  if (normalized.includes('meeting')) return 'meeting';
  if (normalized.includes('study')) return 'study';
  if (normalized.includes('admin') || normalized.includes('email')) return 'admin';
  if (normalized.includes('work') || normalized.includes('focus')) return 'deep-work';
  if (normalized.includes('creative')) return 'creative';
  return 'other';
}

function getRewardLevel(points: number): RewardProfile['level'] {
  if (points >= 2000) return 'Platinum';
  if (points >= 1200) return 'Gold';
  if (points >= 600) return 'Silver';
  return 'Bronze';
}

function sanitizeTimeLabel(value?: string): string | null {
  if (!value) return null;
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function buildDemoActivityLogs(doneTasks: AuditDoneTask[]): FocusActivityLogEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  const fallbackStarts = ['07:00', '08:00', '10:00', '13:00', '16:00', '19:00', '21:00'];
  let carryMinute = 7 * 60;

  const logs = doneTasks.flatMap((task, index) => {
    const taskLabel = `${task.name} ${task.description ?? ''}`.toLowerCase();
    const startLabel = sanitizeTimeLabel(task.startTime) ?? fallbackStarts[index % fallbackStarts.length];
    const startMinute = timeLabelToMinute(startLabel);
    const duration = task.duration && task.duration > 0 ? task.duration : 60;
    const primaryActivity = taskLabel.includes('travel')
      ? 'commute'
      : taskLabel.includes('study') || taskLabel.includes('class') || taskLabel.includes('model')
        ? 'study'
        : taskLabel.includes('news') || taskLabel.includes('research')
          ? 'research'
          : taskLabel.includes('admin')
            ? 'admin'
            : 'focus';

    const effectiveStart = Number.isFinite(startMinute) && startMinute > 0 ? startMinute : carryMinute;
    const breakMinutes = duration >= 90 ? 10 : 0;
    const mainDuration = Math.max(15, duration - breakMinutes);
    const entryBase = `${today}T${minuteToTimeLabel(effectiveStart)}`;
    const entries: FocusActivityLogEntry[] = [
      {
        id: `demo-${task.id}-main`,
        timestamp: entryBase,
        duration: mainDuration,
        activity: primaryActivity,
        notes: task.name,
      },
    ];

    if (breakMinutes > 0) {
      entries.push({
        id: `demo-${task.id}-break`,
        timestamp: `${today}T${minuteToTimeLabel((effectiveStart + mainDuration) % 1440)}`,
        duration: breakMinutes,
        activity: primaryActivity === 'commute' ? 'idle' : 'rest',
        notes: `Short break after ${task.name}`,
      });
    }

    carryMinute = (effectiveStart + duration + 15) % 1440;
    return entries;
  });

  if (logs.length === 0) {
    return [
      {
        id: 'demo-audit-focus',
        timestamp: `${today}T09:00`,
        duration: 60,
        activity: 'focus',
        notes: 'Demo focus session',
      },
      {
        id: 'demo-audit-break',
        timestamp: `${today}T10:00`,
        duration: 15,
        activity: 'rest',
        notes: 'Demo break',
      },
      {
        id: 'demo-audit-study',
        timestamp: `${today}T10:15`,
        duration: 45,
        activity: 'study',
        notes: 'Demo study session',
      },
    ];
  }

  return logs;
}

export function FocusAuditorWorkspace() {
  const { tasks } = useTasks();
  const [activityLogs, setActivityLogs] = useState<FocusActivityLogEntry[]>([]);
  const [activityJson, setActivityJson] = useState('');
  const [taskAuditResult, setTaskAuditResult] = useState<AuditTaskAlignmentOutput | null>(null);
  const [rewardProfile, setRewardProfile] = useState<RewardProfile>({
    totalPoints: 0,
    currentStreak: 0,
    bestStreak: 0,
    level: 'Bronze',
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // 1. Initial local load
    const storedLogs = loadFocusActivityLogs();
    const storedResult = localStorage.getItem('focusWeave.focusAuditor.taskResult');
    const storedReward = localStorage.getItem(REWARD_STORAGE_KEY);

    setActivityLogs(storedLogs);
    setActivityJson(storedLogs.length > 0 ? JSON.stringify(storedLogs, null, 2) : '');

    if (storedResult) {
      try {
        setTaskAuditResult(JSON.parse(storedResult));
      } catch (e) {
        console.error("Failed to load task result");
      }
    }
    if (storedReward) {
      try {
        setRewardProfile(JSON.parse(storedReward));
      } catch (e) {
        console.error('Failed to load reward profile');
      }
    }

    // 2. Fetch latest from Cloud if user exists
    if (user?.uid) {
      const userRef = doc(db, 'userPreferences', user.uid);
      const loadCloud = async () => {
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            const history = data.auditHistory || [];
            if (history.length > 0) {
              const latest = history[history.length - 1];
              setTaskAuditResult(latest);
              localStorage.setItem('focusWeave.focusAuditor.taskResult', JSON.stringify(latest));
            }
          }
        } catch (err) {
          console.warn("[FocusAuditor] Failed to load from cloud on mount:", err);
        }
      };
      loadCloud();
    }

    setIsLoaded(true);
  }, [user?.uid]);

  const actualTimeline = buildActualTimeline(activityLogs);
  const behaviorSignals = useMemo<BehaviorSignalSnapshot[]>(() => {
    if (activityLogs.length === 0) return [];
    const doneTasks = tasks.filter((task) => task.status === 'done');
    const deepWorkTaskIds = new Set(
      doneTasks
        .filter((task) => getTaskTypeFromTask(task.name, task.description) === 'deep-work')
        .map((task) => task.id)
    );

    return activityLogs.flatMap((entry, index) => {
      const start = resolveActivityTimestamp(entry.timestamp);
      if (!start) {
        return [];
      }

      const end = new Date(start.getTime() + entry.duration * 60_000);
      const appSwitches = entry.activity === 'social' ? 10 : entry.activity === 'idle' ? 7 : 2;
      const interruptions = entry.activity === 'social' || entry.activity === 'meeting' ? 4 : 1;
      const delayCount = entry.activity === 'idle' ? 2 : 0;
      const taskType = getTaskTypeFromActivity(entry.activity);

      return [{
        timestamp: entry.timestamp,
        taskId: doneTasks[index % Math.max(doneTasks.length, 1)]?.id,
        taskType,
        actualStart: start.toISOString(),
        actualEnd: end.toISOString(),
        completionStatus: entry.activity === 'idle' || entry.activity === 'social' ? 'partial' : 'completed',
        completionMinutes: Math.max(1, Math.round(entry.duration * (entry.activity === 'social' ? 0.6 : 0.9))),
        expectedMinutes: entry.duration,
        appSwitches,
        idleMinutes: entry.activity === 'idle' ? Math.round(entry.duration * 0.8) : Math.round(entry.duration * 0.15),
        sessionMinutes: entry.duration,
        energyRating: entry.activity === 'sleep' ? 8 : 6,
        breakCount: entry.activity === 'rest' ? 1 : 0,
        interruptions,
        delayCount,
        wasRescheduled: deepWorkTaskIds.has(doneTasks[index % Math.max(doneTasks.length, 1)]?.id ?? '') && delayCount > 0,
        distractingAppOpenCount: entry.activity === 'social' ? 1 : 0,
      }];
    });
  }, [activityLogs, tasks]);

  const behaviorIntelligence = useMemo(() => {
    if (behaviorSignals.length === 0) return null;
    return runBehaviorIntelligence([], behaviorSignals);
  }, [behaviorSignals]);
  function importLogs() {
    const parsed = parseActivityLogJson(activityJson);
    if (parsed.errors.length > 0) {
      setValidationErrors(parsed.errors);
      toast({
        variant: 'destructive',
        title: 'Could not import activity logs',
        description: parsed.errors[0],
      });
      return;
    }

    setValidationErrors([]);
    setActivityLogs(parsed.entries);
    saveFocusActivityLogs(parsed.entries);
    toast({
      title: 'Activity logs imported',
      description: `${parsed.entries.length} entry(s) are ready for audit.`,
    });
  }

  async function runAudit() {
    const doneTasks = tasks.filter(t => t.status === 'done').map(t => {
      let duration: number | undefined = undefined;
      
      if (t.startTime && t.endTime) {
        const startMin = timeLabelToMinute(t.startTime);
        const endMin = timeLabelToMinute(t.endTime);
        
        if (startMin < endMin) {
          duration = endMin - startMin;
        } else if (startMin > endMin) {
          // Task spans across midnight
          duration = (1440 - startMin) + endMin;
        }
      }

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        duration,
        startTime: t.startTime,
        endTime: t.endTime,
      } satisfies AuditDoneTask;
    });

    if (doneTasks.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No tasks to audit',
        description: 'You need at least one task marked as "Done" to run this audit.',
      });
      return;
    }

    const parsed = activityJson.trim() ? parseActivityLogJson(activityJson) : { entries: [], errors: ['No activity logs were provided.'] };
    const shouldUseDemoLogs = parsed.errors.length > 0 || parsed.entries.length === 0;
    const auditEntries = shouldUseDemoLogs ? buildDemoActivityLogs(doneTasks) : parsed.entries;

    setIsAuditing(true);
    setValidationErrors(shouldUseDemoLogs ? [] : parsed.errors);
    
    // Ensure state matches what we are auditing
    setActivityLogs(auditEntries);
    setActivityJson(JSON.stringify(auditEntries, null, 2));
    saveFocusActivityLogs(auditEntries);

    try {
      const result = await handleAuditTaskAlignment({
        doneTasks,
        activityLogs: auditEntries.map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          duration: e.duration,
          activity: e.activity
        }))
      });

      setTaskAuditResult(result);
      localStorage.setItem('focusWeave.focusAuditor.taskResult', JSON.stringify(result));

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const earnedPoints = Math.max(10, Math.round(result.alignedMinutes * 0.8 + result.alignmentScore * 1.5));

      setRewardProfile((current) => {
        const alreadyRewardedToday = current.lastRewardDate === today;
        const nextStreak =
          alreadyRewardedToday
            ? current.currentStreak
            : current.lastRewardDate === yesterday
              ? current.currentStreak + 1
              : 1;

        const updated: RewardProfile = {
          totalPoints: current.totalPoints + (alreadyRewardedToday ? 0 : earnedPoints),
          currentStreak: nextStreak,
          bestStreak: Math.max(current.bestStreak, nextStreak),
          lastRewardDate: today,
          level: getRewardLevel(current.totalPoints + (alreadyRewardedToday ? 0 : earnedPoints)),
        };
        localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });

      // Store in Firestore with date
      if (user?.uid) {
        try {
          const userRef = doc(db, 'userPreferences', user.uid);
          const auditWithDate = {
            ...result,
            date: new Date().toISOString(),
            type: 'task-alignment'
          };

          await setDoc(userRef, {
            auditHistory: arrayUnion(auditWithDate)
          }, { merge: true });

          console.log("[FocusAuditor] Audit result saved to cloud.");
        } catch (cloudErr) {
          console.error("[FocusAuditor] Failed to save to cloud:", cloudErr);
        }
      }

      toast({
        title: 'Task Audit Complete',
        description: shouldUseDemoLogs
          ? `Demo activity logs were generated and audited. Focus alignment: ${result.alignmentScore}%.`
          : `Your focus alignment is ${result.alignmentScore}%. Result synced to cloud.`,
      });
    } catch (err) {
      console.error("[FocusAuditor] Audit error:", err);
    } finally {
      setIsAuditing(false);
    }
  }

  if (!isLoaded) {
    return <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">Loading Focus Auditor...</div>;
  }

  const taskChartData = taskAuditResult?.taskBreakdown.map(item => ({
    name: item.taskName,
    minutes: item.actualMinutes,
  })) || [];

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BrainCircuit className="h-6 w-6 text-primary" />
            Adaptive Focus Auditor
          </CardTitle>
          <CardDescription>
            The Task-Based Auditor uses AI to semantically map your activity logs to your actual completed tasks, measuring true productivity over just staying busy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="px-3 py-1 text-xs">Custom 24h profile</Badge>
            <Badge variant="secondary" className="px-3 py-1 text-xs">JSON log validation</Badge>
            <Badge variant="secondary" className="px-3 py-1 text-xs">Weighted alignment scoring</Badge>
            <Badge variant="secondary" className="px-3 py-1 text-xs">AI coaching insights</Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={runAudit} disabled={isAuditing}>
              {isAuditing ? (
                <Sparkles className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Target className="mr-2 h-4 w-4" />
              )}
              {isAuditing ? 'Auditing...' : 'Run Task Audit'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {validationErrors.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Setup issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-destructive">
            {validationErrors.slice(0, 5).map((error) => (
              <p key={error}>{error}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visualization">Logs Visualization</TabsTrigger>
          <TabsTrigger value="logs">Activity Input</TabsTrigger>
          <TabsTrigger value="results">Audit Results</TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>Real-time detection</CardDescription>
                <CardTitle className="text-xl">
                  {behaviorIntelligence ? behaviorIntelligence.cognitiveState.state.replace('-', ' ') : 'Waiting for activity data'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Live cognitive-state estimate based on session length, switching, interruptions, and completion velocity.
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>Root cause AI</CardDescription>
                <CardTitle className="text-xl">
                  {behaviorIntelligence?.loops[0]?.type.replace('-', ' ') || 'No dominant loop'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {behaviorIntelligence?.loops[0]?.description || 'Import more logs to identify behavior loops like distraction or avoidance.'}
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>Dopamine reward system</CardDescription>
                <CardTitle className="text-xl">{rewardProfile.totalPoints} points</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Level {rewardProfile.level} · {rewardProfile.currentStreak}-day streak.
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <FocusClock
              title="Actual Day Map"
              subtitle="Where your time actually went, visualized across 24 hours."
              segments={actualTimeline}
              emptyLabel="Import activity logs to see your daily focus map."
            />

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Visualization Feed</CardTitle>
                <CardDescription>
                  Chronological breakdown of imported activity logs.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-auto">
                {activityLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      No activity data found.<br/>Import logs using the Activity Input tab.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activityLogs.map((entry) => {
                      const color = getFocusColor(entry.activity);
                      return (
                        <div
                          key={entry.id}
                          className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-4 py-3 transition-all hover:shadow-md"
                        >
                          <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-xl" style={{ backgroundColor: color }} />
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-black"
                            style={{ backgroundColor: color }}
                          >
                            {entry.duration}m
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">
                                {FOCUS_AUDITOR_LABELS[entry.activity] || entry.activity}
                              </span>
                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold text-muted-foreground">
                                {entry.timestamp}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.notes || 'No notes added'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Activity Log JSON Input
              </CardTitle>
              <CardDescription>
                Paste JSON entries with `timestamp`, `duration`, and `activity`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={activityJson}
                onChange={(event) => setActivityJson(event.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder='[{"timestamp":"2026-04-14T09:00:00","duration":45,"activity":"focus"}]'
              />
              <div className="flex flex-wrap gap-3">
                <Button onClick={importLogs}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Import & Visualize
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {!taskAuditResult ? (
            <Card className="shadow-sm">
              <CardContent className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <Target className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <h3 className="text-xl font-semibold">Ready for Audit</h3>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  The AI will compare your <strong>Done Tasks</strong> with your <strong>Activity Logs</strong>.
                  It semantically matches site names and descriptions to your task names to uncover your true focus alignment.
                </p>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <p className="text-sm font-medium">Requirements:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${tasks.filter(t => t.status === 'done').length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                      At least one task marked as "Done"
                    </li>
                    <li className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${activityLogs.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                      Imported Activity Logs
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Overall Alignment</CardDescription>
                    <CardTitle className="text-5xl font-extrabold tracking-tight">
                      {taskAuditResult.alignmentScore}
                      <span className="text-lg font-medium text-muted-foreground">%</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-1000"
                        style={{ width: `${taskAuditResult.alignmentScore}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Tracked Minutes</CardDescription>
                    <CardTitle className="text-4xl font-bold">{taskAuditResult.totalTrackedMinutes}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Total duration across all activity logs analyzed.
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Aligned Focus</CardDescription>
                    <CardTitle className="text-4xl font-bold">{taskAuditResult.alignedMinutes}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Minutes spent on activities that strongly match your done tasks.
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Reward Status</CardDescription>
                    <CardTitle className="flex items-center gap-2 text-3xl font-bold">
                      <Trophy className="h-7 w-7 text-primary" />
                      {rewardProfile.totalPoints}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {rewardProfile.level} tier · <Flame className="mr-1 inline h-4 w-4 text-orange-500" /> {rewardProfile.currentStreak}-day streak.
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Task Breakdown
                      </CardTitle>
                      <CardDescription>
                        Semantic time allocation per completed task.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task Name</TableHead>
                            <TableHead className="text-right">Actual Time</TableHead>
                            <TableHead className="text-right">Weight</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taskAuditResult.taskBreakdown.map((item) => (
                            <TableRow key={item.taskId} className="group transition-colors hover:bg-muted/30">
                              <TableCell className="font-medium">{item.taskName}</TableCell>
                              <TableCell className="text-right">{item.actualMinutes} min</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="font-mono">
                                  {item.alignmentPercentage}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {taskAuditResult.unrelatedMinutes > 0 && (
                            <TableRow className="bg-muted/20 italic">
                              <TableCell>Unrelated/Distractions</TableCell>
                              <TableCell className="text-right">{taskAuditResult.unrelatedMinutes} min</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="text-muted-foreground">
                                  {taskAuditResult.totalTrackedMinutes > 0
                                    ? Math.round((taskAuditResult.unrelatedMinutes / taskAuditResult.totalTrackedMinutes) * 100)
                                    : 0}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChartIcon className="h-5 w-5 text-primary" />
                        Time Distribution Graph
                      </CardTitle>
                      <CardDescription>
                        Visual comparison of minutes spent per task category.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={taskChartData} layout="vertical" margin={{ left: 20, right: 30, top: 10 }}>
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fill: 'currentColor', fontSize: 12 }}
                          />
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <Bar
                            dataKey="minutes"
                            fill="hsl(var(--primary))"
                            radius={[0, 4, 4, 0]}
                            barSize={32}
                            label={{ position: 'right', fill: 'currentColor', fontSize: 11, formatter: (val: number) => `${val}m` }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="border-primary/20 bg-primary/5 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Coach Insights
                      </CardTitle>
                      <CardDescription>
                        Deeper patterns identified by comparing your intent with actual behavior.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {taskAuditResult.insights.map((insight, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                            {idx + 1}
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {insight}
                          </p>
                        </div>
                      ))}
                      {behaviorIntelligence?.loops.length ? (
                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Root cause AI</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {behaviorIntelligence.loops.slice(0, 2).map((loop) => (
                              <li key={loop.type}>
                                • {loop.description} ({loop.severity}, {loop.occurrences} signals)
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <FocusClock
                    title="Actual Day Map"
                    subtitle="Where your time actually went."
                    segments={actualTimeline}
                    emptyLabel="No logs to map."
                  />
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
