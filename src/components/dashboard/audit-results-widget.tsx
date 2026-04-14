'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTasks } from '@/contexts/tasks-context';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BrainCircuit, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function AuditResultsWidget() {
  const { auditHistory, isLoading } = useTasks();

  if (isLoading) {
    return (
      <Card className="flex h-[320px] items-center justify-center border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">Loading audit history...</span>
        </div>
      </Card>
    );
  }

  const chartData = [...auditHistory]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7) // Last 7 audits
    .map((audit) => ({
      date: format(new Date(audit.date), 'MMM dd'),
      score: audit.alignmentScore,
      fullDate: format(new Date(audit.date), 'PPpp'),
    }));

  const latestScore = auditHistory.length > 0 
    ? auditHistory[auditHistory.length - 1].alignmentScore 
    : 0;
  
  const previousScore = auditHistory.length > 1
    ? auditHistory[auditHistory.length - 2].alignmentScore
    : latestScore;
  
  const diff = latestScore - previousScore;

  return (
    <Card className="group overflow-hidden border-border/40 bg-card/60 shadow-xl transition-all hover:shadow-2xl hover:border-primary/20 backdrop-blur-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 border border-primary/20 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Focus Alignment</CardTitle>
              <CardDescription>Historical productivity trends</CardDescription>
            </div>
          </div>
          {diff !== 0 && (
            <Badge variant={diff > 0 ? "default" : "destructive"} className="gap-1 animate-in slide-in-from-right-2 duration-500">
              <TrendingUp className={`h-3 w-3 ${diff < 0 ? 'rotate-180' : ''}`} />
              {diff > 0 ? `+${diff}%` : `${diff}%`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {auditHistory.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center text-center space-y-3">
            <div className="rounded-2xl bg-muted/50 p-4 border border-dashed border-border/60">
              <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[200px] italic">
              No audit history found. run your first audit to see trends!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-[180px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={4}
                    dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/10 p-3">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Current Score</p>
                <p className="text-2xl font-black text-foreground">
                  {latestScore}<span className="text-sm font-bold text-muted-foreground ml-0.5">%</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Last Audit</p>
                <p className="text-xs font-bold text-foreground">
                  {chartData.length > 0 ? chartData[chartData.length - 1].date : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
