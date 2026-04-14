'use client';

import React, { useState } from 'react';
import { getFocusColor, minuteToTimeLabel } from '@/lib/focus-auditor-engine';
import type { FocusTimelineSegment } from '@/types/focus-auditor';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FocusClockProps = {
  title: string;
  subtitle: string;
  segments: FocusTimelineSegment[];
  emptyLabel: string;
};

export function FocusClock({ title, subtitle, segments, emptyLabel }: FocusClockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredSegment = hoveredIndex !== null ? segments[hoveredIndex] : null;

  const size = 340;
  const center = size / 2;
  const outerRadius = 140;
  const ringWidth = 44;
  const midRadius = outerRadius - ringWidth / 2;

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (startMin: number, endMin: number, r: number) => {
    const startDeg = (startMin / 1440) * 360;
    const endDeg = (endMin / 1440) * 360;
    const sweep = endDeg - startDeg;
    const largeArc = sweep > 180 ? 1 : 0;
    const s = polarToCartesian(center, center, r, startDeg);
    const e = polarToCartesian(center, center, r, endDeg);
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const hours = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <Card className="overflow-hidden shadow-lg">
      <CardHeader className="pb-2 text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {segments.length === 0 ? (
          <div className="mx-auto flex h-[280px] w-[280px] flex-col items-center justify-center rounded-full border-2 border-dashed border-border text-center">
            <svg className="mb-3 h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="max-w-[200px] text-sm text-muted-foreground">{emptyLabel}</p>
          </div>
        ) : (
          <>
            {/* SVG Clock */}
            <div className="relative mx-auto" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background ring */}
                <circle cx={center} cy={center} r={midRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth={ringWidth} strokeOpacity={0.4} />

                {/* Activity arcs */}
                {segments.map((seg, i) => {
                  const color = getFocusColor(seg.type);
                  const isHovered = hoveredIndex === i;
                  return (
                    <path
                      key={i}
                      d={describeArc(seg.startMinute, seg.endMinute, midRadius)}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? ringWidth + 6 : ringWidth}
                      strokeLinecap="butt"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 10px ${color})` : `drop-shadow(0 0 4px ${color}55)`,
                        opacity: isHovered ? 1 : 0.85,
                      }}
                    />
                  );
                })}

                {/* Hour labels */}
                {hours.map((h) => {
                  const deg = (h / 24) * 360;
                  const pos = polarToCartesian(center, center, outerRadius + 16, deg);
                  const tickInner = polarToCartesian(center, center, outerRadius + 2, deg);
                  const tickOuter = polarToCartesian(center, center, outerRadius + 8, deg);
                  return (
                    <g key={h}>
                      <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} stroke="hsl(var(--foreground))" strokeOpacity={0.25} strokeWidth={1.5} />
                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="hsl(var(--foreground))"
                        fillOpacity={0.5}
                        fontSize={11}
                        fontWeight={700}
                      >
                        {h === 0 ? '0' : h}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Center panel */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-full bg-card border border-border shadow-md text-center">
                  {hoveredSegment ? (
                    <div className="px-2">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        Viewing
                      </div>
                      <div className="mt-0.5 text-xs font-black text-foreground leading-tight">
                        {hoveredSegment.label}
                      </div>
                      <div className="mt-1 font-mono text-[10px] font-semibold text-muted-foreground">
                        {minuteToTimeLabel(hoveredSegment.startMinute)}–{minuteToTimeLabel(hoveredSegment.endMinute)}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] font-bold text-primary">
                        {hoveredSegment.minutes}m
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        Activity
                      </div>
                      <div className="mt-0.5 text-3xl font-black text-foreground">
                        {segments.length}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground">
                        Blocks
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {segments.slice(0, 12).map((seg, i) => {
                const color = getFocusColor(seg.type);
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-all cursor-pointer",
                      hoveredIndex === i
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                        {seg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">
                        {minuteToTimeLabel(seg.startMinute)}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                        {seg.minutes}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
