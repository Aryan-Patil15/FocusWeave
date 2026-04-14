'use client';

import { useEffect, useState, useTransition } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { BrainCircuit, ClipboardList, PlusCircle, Sparkles, Target, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { handleGenerateFocusInsights } from '@/lib/actions';
import {
  buildActualTimeline,
  buildFocusAuditResult,
  buildFocusInsightFallback,
  buildPlanTimeline,
  FOCUS_AUDITOR_COLORS,
  FOCUS_AUDITOR_LABELS,
  focusAuditorSampleLogsJson,
  focusAuditorSamplePlan,
  minuteToTimeLabel,
  parseActivityLogJson,
  timeLabelToMinute,
  validateActivityLogs,
  validateFocusPlanBlocks,
} from '@/lib/focus-auditor-engine';
import {
  loadFocusActivityLogs,
  loadFocusAuditResult,
  loadFocusPlanBlocks,
  saveFocusActivityLogs,
  saveFocusAuditResult,
  saveFocusPlanBlocks,
} from '@/lib/focus-auditor-storage';
import { FocusClock } from '@/components/focus-auditor/focus-clock';
import type { FocusActivityLogEntry, FocusAuditResult, FocusPlanBlock, FocusPlanType, FocusTimelineSegment } from '@/types/focus-auditor';
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
  const [planBlocks, setPlanBlocks] = useState<FocusPlanBlock[]>([]);
  const [activityLogs, setActivityLogs] = useState<FocusActivityLogEntry[]>([]);
  const [activityJson, setActivityJson] = useState('');
  const [auditResult, setAuditResult] = useState<FocusAuditResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGeneratingInsights, startInsightsTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const storedPlan = loadFocusPlanBlocks();
    const storedLogs = loadFocusActivityLogs();
    const storedResult = loadFocusAuditResult();

    setPlanBlocks(storedPlan);
    setActivityLogs(storedLogs);
    setActivityJson(storedLogs.length > 0 ? JSON.stringify(storedLogs, null, 2) : '');
    setAuditResult(storedResult);
    setIsLoaded(true);
  }, []);

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

  function loadSamplePlan() {
    setPlanBlocks(focusAuditorSamplePlan);
    saveFocusPlanBlocks(focusAuditorSamplePlan);
    toast({
      title: 'Sample plan loaded',
      description: 'A full 24-hour sample routine has been added to the plan builder.',
    });
  }

  function loadSampleLogs() {
    setActivityJson(focusAuditorSampleLogsJson);
    toast({
      title: 'Sample logs loaded',
      description: 'Review the JSON and import it to test the auditor.',
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
    const planErrors = validateFocusPlanBlocks(planBlocks);
    const logErrors = validateActivityLogs(activityLogs);
    const errors = [...planErrors, ...logErrors];

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        variant: 'destructive',
        title: 'Fix audit setup first',
        description: errors[0],
      });
      return;
    }

    const baseResult = buildFocusAuditResult(planBlocks, activityLogs);
    const fallbackInsights = buildFocusInsightFallback(baseResult);
    const optimisticResult = { ...baseResult, insights: fallbackInsights };

    setValidationErrors([]);
    setAuditResult(optimisticResult);
    saveFocusAuditResult(optimisticResult);

    toast({
      title: 'Audit complete',
      description: `Alignment score: ${optimisticResult.alignmentScore}/100.`,
    });

    startInsightsTransition(() => {
      handleGenerateFocusInsights({
        alignmentScore: baseResult.alignmentScore,
        trackedMinutes: baseResult.trackedMinutes,
        categoryBreakdown: baseResult.categoryBreakdown.map((item) => ({
          label: item.label,
          alignment: item.alignment,
          trackedMinutes: item.trackedMinutes,
        })),
        topDeviations: baseResult.topDeviations.map((item) => ({
          summary: item.summary,
          pointImpact: item.pointImpact,
          duration: item.duration,
        })),
      })
        .then((insightResult) => {
          const enrichedResult = { ...baseResult, insights: insightResult.insights };
          setAuditResult(enrichedResult);
          saveFocusAuditResult(enrichedResult);
        })
        .catch(() => {
          setAuditResult(optimisticResult);
          saveFocusAuditResult(optimisticResult);
        });
    });
  }

  if (!isLoaded) {
    return <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">Loading Focus Auditor...</div>;
  }

  const categoryChartData =
    auditResult?.categoryBreakdown.map((item) => ({
      name: item.label,
      alignment: item.alignment,
    })) ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BrainCircuit className="h-6 w-6 text-primary" />
            Adaptive Focus Auditor
          </CardTitle>
          <CardDescription>
            Define a personalized 24-hour rhythm, import timestamped activity logs, then compare plan versus reality minute by minute.
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
            <Button variant="outline" onClick={loadSamplePlan}>Load Sample Plan</Button>
            <Button variant="outline" onClick={loadSampleLogs}>Load Sample Logs</Button>
            <Button onClick={runAudit}>
              <Target className="mr-2 h-4 w-4" />
              Run Audit
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

      <Tabs defaultValue="plan" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plan">Plan Builder</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Custom Profile Builder</CardTitle>
                  <CardDescription>
                    Each block defines what your ideal day should look like. Midnight-crossing blocks are supported.
                  </CardDescription>
                </div>
                <Button onClick={addPlanBlock} variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Block
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {planBlocks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-8 text-sm text-muted-foreground">
                    No plan blocks yet. Add one manually or load the sample plan.
                  </div>
                ) : (
                  planBlocks.map((block) => (
                    <div key={block.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="md:col-span-1">
                          <label className="mb-2 block text-sm font-medium">Label</label>
                          <Input
                            value={block.label ?? ''}
                            onChange={(event) => updatePlanBlock(block.id, { label: event.target.value })}
                            placeholder={FOCUS_AUDITOR_LABELS[block.type]}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium">Type</label>
                          <Select
                            value={block.type}
                            onValueChange={(value) => updatePlanBlock(block.id, { type: value as FocusPlanType })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FOCUS_AUDITOR_PLAN_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {FOCUS_AUDITOR_LABELS[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium">Start</label>
                          <Input
                            type="time"
                            value={minuteToTimeLabel(block.startMinute)}
                            onChange={(event) => updatePlanBlock(block.id, { startMinute: timeLabelToMinute(event.target.value) })}
                          />
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <label className="block text-sm font-medium">End</label>
                            <Button variant="ghost" size="sm" onClick={() => removePlanBlock(block.id)}>Remove</Button>
                          </div>
                          <Input
                            type="time"
                            value={minuteToTimeLabel(block.endMinute)}
                            onChange={(event) => updatePlanBlock(block.id, { endMinute: timeLabelToMinute(event.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <FocusClock
              title="Planned Day Preview"
              subtitle="A circular view of your intended daily rhythm."
              segments={planTimeline}
              emptyLabel="Add plan blocks to see your circular schedule."
            />
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Activity Log Input
                </CardTitle>
                <CardDescription>
                  Paste JSON entries with `timestamp`, `duration`, and `activity`. Up to 200 entries, with timestamps in ISO 8601 or HH:mm format.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={activityJson}
                  onChange={(event) => setActivityJson(event.target.value)}
                  className="min-h-[360px] font-mono text-sm"
                  placeholder='[{"timestamp":"2026-04-14T09:00:00","duration":45,"activity":"focus"}]'
                />
                <div className="flex flex-wrap gap-3">
                  <Button onClick={importLogs}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Import Logs
                  </Button>
                  <Button variant="outline" onClick={loadSampleLogs}>Paste Sample JSON</Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <FocusClock
                title="Actual Day Preview"
                subtitle="Imported activity logs rendered across the day."
                segments={actualTimeline}
                emptyLabel="Import activity logs to see your actual day map."
              />

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Imported Entries</CardTitle>
                  <CardDescription>
                    {activityLogs.length > 0 ? `${activityLogs.length} entry(s) ready for analysis.` : 'No activity entries imported yet.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[320px] overflow-auto">
                  {activityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Use the JSON import to load your actual activity data.</p>
                  ) : (
                    <div className="space-y-2">
                      {activityLogs.slice(0, 12).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">{FOCUS_AUDITOR_LABELS[entry.activity]}</p>
                            <p className="text-xs text-muted-foreground">{entry.notes || 'No note added'}</p>
                          </div>
                          <div className="text-right">
                            <p>{entry.duration} min</p>
                            <p className="text-xs text-muted-foreground">{entry.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {!auditResult ? (
            <Card className="shadow-sm">
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center text-center">
                <Target className="mb-4 h-10 w-10 text-primary" />
                <h3 className="text-xl font-semibold">Run your first audit</h3>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Once you have a plan and imported activity logs, the Focus Auditor will generate an alignment score, deviations, timelines, and coaching insights here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Alignment Score</CardDescription>
                    <CardTitle className="text-4xl">{auditResult.alignmentScore}<span className="text-lg text-muted-foreground">/100</span></CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {auditResult.earnedPoints.toFixed(1)} points earned across {auditResult.trackedMinutes} planned minutes.
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Tracked Blocks</CardDescription>
                    <CardTitle className="text-4xl">{auditResult.categoryBreakdown.length}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Personalized categories evaluated against your imported activity logs.
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Detected Deviations</CardDescription>
                    <CardTitle className="text-4xl">{auditResult.deviations.length}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Biggest mismatches are grouped into contiguous time windows for easier review.
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <TimelineStrip
                  title="Planned Timeline"
                  segments={auditResult.planTimeline}
                  emptyLabel="No planned timeline available."
                />
                <TimelineStrip
                  title="Actual Timeline"
                  segments={auditResult.actualTimeline}
                  emptyLabel="No actual timeline available."
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Per-Category Alignment</CardTitle>
                    <CardDescription>
                      See which planned blocks held up well and which ones drifted the most.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={90} />
                        <Bar dataKey="alignment" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Focus Insights
                    </CardTitle>
                    <CardDescription>
                      {isGeneratingInsights ? 'Refreshing AI coaching...' : 'AI-generated when available, with a rule-based fallback.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {auditResult.insights.map((insight) => (
                      <div key={insight} className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
                        {insight}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Deviation Report</CardTitle>
                  <CardDescription>
                    Exact mismatch windows with expected activity, actual activity, duration, and point impact.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {auditResult.deviations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deviations were detected. Your actual activity matched the plan throughout covered blocks.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time Range</TableHead>
                          <TableHead>Expected</TableHead>
                          <TableHead>Actual</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Impact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditResult.deviations.slice(0, 18).map((deviation) => (
                          <TableRow key={deviation.id}>
                            <TableCell>{minuteToTimeLabel(deviation.startMinute)}-{minuteToTimeLabel(deviation.endMinute)}</TableCell>
                            <TableCell>{FOCUS_AUDITOR_LABELS[deviation.expected]}</TableCell>
                            <TableCell>{FOCUS_AUDITOR_LABELS[deviation.actual]}</TableCell>
                            <TableCell>{deviation.duration} min</TableCell>
                            <TableCell>-{deviation.pointImpact.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
