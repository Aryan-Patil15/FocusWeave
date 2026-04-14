'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { BarChart as BarChartIcon, BrainCircuit, ClipboardList, PlusCircle, Sparkles, Target, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  buildPlanTimeline,
  FOCUS_AUDITOR_COLORS,
  FOCUS_AUDITOR_LABELS,
  getFocusColor,
  minuteToTimeLabel,
  parseActivityLogJson,
  timeLabelToMinute,
  validateActivityLogs,
  validateFocusPlanBlocks,
} from '@/lib/focus-auditor-engine';
import {
  loadFocusActivityLogs,
  loadFocusPlanBlocks,
  saveFocusActivityLogs,
  saveFocusAuditResult,
  saveFocusPlanBlocks,
} from '@/lib/focus-auditor-storage';
import { FocusClock } from '@/components/focus-auditor/focus-clock';
import type { FocusActivityLogEntry, FocusPlanBlock, FocusPlanType, FocusTimelineSegment } from '@/types/focus-auditor';
import { FOCUS_AUDITOR_PLAN_TYPES } from '@/types/focus-auditor';

function createEmptyBlock(): FocusPlanBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    type: 'focus',
    startMinute: 9 * 60,
    endMinute: 10 * 60,
  };
}

function TimelineStrip({ title, segments, emptyLabel }: { title: string; segments: FocusTimelineSegment[]; emptyLabel: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">00:00 to 24:00</span>
      </div>

      {segments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <>
          <div className="flex h-8 overflow-hidden rounded-full border border-border bg-muted/30">
            {segments.map((segment) => (
              <div
                key={`${title}-${segment.startMinute}-${segment.type}`}
                style={{
                  width: `${(segment.minutes / 1440) * 100}%`,
                  backgroundColor: FOCUS_AUDITOR_COLORS[segment.type],
                }}
                title={`${segment.label}: ${minuteToTimeLabel(segment.startMinute)}-${minuteToTimeLabel(segment.endMinute)}`}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {segments.slice(0, 8).map((segment) => (
              <div key={`${segment.type}-${segment.startMinute}`} className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FOCUS_AUDITOR_COLORS[segment.type] }} />
                  <span>{segment.label}</span>
                </div>
                <span className="text-muted-foreground">
                  {minuteToTimeLabel(segment.startMinute)}-{minuteToTimeLabel(segment.endMinute)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FocusAuditorWorkspace() {
  const { tasks } = useTasks();
  const [planBlocks, setPlanBlocks] = useState<FocusPlanBlock[]>([]);
  const [activityLogs, setActivityLogs] = useState<FocusActivityLogEntry[]>([]);
  const [activityJson, setActivityJson] = useState('');
  const [taskAuditResult, setTaskAuditResult] = useState<AuditTaskAlignmentOutput | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // 1. Initial local load
    const storedPlan = loadFocusPlanBlocks();
    const storedLogs = loadFocusActivityLogs();
    const storedResult = localStorage.getItem('focusWeave.focusAuditor.taskResult');

    setPlanBlocks(storedPlan);
    setActivityLogs(storedLogs);
    setActivityJson(storedLogs.length > 0 ? JSON.stringify(storedLogs, null, 2) : '');

    if (storedResult) {
      try {
        setTaskAuditResult(JSON.parse(storedResult));
      } catch (e) {
        console.error("Failed to load task result");
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

  const planTimeline = buildPlanTimeline(planBlocks);
  const actualTimeline = buildActualTimeline(activityLogs);

  function updatePlanBlock(blockId: string, updates: Partial<FocusPlanBlock>) {
    setPlanBlocks((currentBlocks) => {
      const nextBlocks = currentBlocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block));
      saveFocusPlanBlocks(nextBlocks);
      return nextBlocks;
    });
  }

  function addPlanBlock() {
    setPlanBlocks((currentBlocks) => {
      const nextBlocks = [...currentBlocks, createEmptyBlock()];
      saveFocusPlanBlocks(nextBlocks);
      return nextBlocks;
    });
  }

  function removePlanBlock(blockId: string) {
    setPlanBlocks((currentBlocks) => {
      const nextBlocks = currentBlocks.filter((block) => block.id !== blockId);
      saveFocusPlanBlocks(nextBlocks);
      return nextBlocks;
    });
  }
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
    if (!activityJson.trim()) {
      toast({
        variant: 'destructive',
        title: 'No logs detected',
        description: 'Please input your activity logs in the "Activity Logs" tab first.',
      });
      return;
    }

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
      };
    });

    if (doneTasks.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No tasks to audit',
        description: 'You need at least one task marked as "Done" to run this audit.',
      });
      return;
    }

    const parsed = parseActivityLogJson(activityJson);
    if (parsed.errors.length > 0) {
      setValidationErrors(parsed.errors);
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: parsed.errors[0],
      });
      return;
    }

    setIsAuditing(true);
    setValidationErrors([]);
    
    // Ensure state matches what we are auditing
    setActivityLogs(parsed.entries);
    saveFocusActivityLogs(parsed.entries);

    try {
      const result = await handleAuditTaskAlignment({
        doneTasks,
        activityLogs: parsed.entries.map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          duration: e.duration,
          activity: e.activity
        }))
      });

      setTaskAuditResult(result);
      localStorage.setItem('focusWeave.focusAuditor.taskResult', JSON.stringify(result));

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
        description: `Your focus alignment is ${result.alignmentScore}%. Result synced to cloud.`,
      });
    } catch (err) {
      console.error("[FocusAuditor] Audit error:", err);
      toast({
        variant: 'destructive',
        title: 'Audit Failed',
        description: 'Failed to complete the AI semantic audit. Please try again.',
      });
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
              <div className="grid gap-4 md:grid-cols-3">
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
