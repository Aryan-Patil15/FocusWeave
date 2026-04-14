'use client';

import { FOCUS_AUDITOR_COLORS, minuteToTimeLabel } from '@/lib/focus-auditor-engine';
import type { FocusTimelineSegment } from '@/types/focus-auditor';

type FocusClockProps = {
  title: string;
  subtitle: string;
  segments: FocusTimelineSegment[];
  emptyLabel: string;
};

function buildClockGradient(segments: FocusTimelineSegment[]): string {
  if (segments.length === 0) {
    return 'conic-gradient(#e2e8f0 0deg 360deg)';
  }

  const stops = segments.map((segment) => {
    const startDeg = (segment.startMinute / 1440) * 360;
    const endDeg = (segment.endMinute / 1440) * 360;
    const color = FOCUS_AUDITOR_COLORS[segment.type];
    return `${color} ${startDeg}deg ${endDeg}deg`;
  });

  return `conic-gradient(${stops.join(', ')})`;
}

export function FocusClock({ title, subtitle, segments, emptyLabel }: FocusClockProps) {
  const gradient = buildClockGradient(segments);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {segments.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <>
          <div className="relative mx-auto flex h-64 w-64 items-center justify-center rounded-full" style={{ backgroundImage: gradient }}>
            <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border border-border bg-card/95 text-center shadow-inner backdrop-blur">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">24h View</div>
              <div className="mt-2 text-sm font-medium">{segments.length} segments</div>
              <div className="mt-1 text-xs text-muted-foreground">Starts at 00:00, wraps through midnight</div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {segments.slice(0, 8).map((segment) => (
              <div key={`${segment.type}-${segment.startMinute}`} className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: FOCUS_AUDITOR_COLORS[segment.type] }} />
                  <span className="font-medium">{segment.label}</span>
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
