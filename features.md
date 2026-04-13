# DeyWeaver — Feature Overview & Impact Analysis

## Project Summary

**DeyWeaver** is an AI-powered productivity platform that goes beyond generic scheduling tools. Rather than forcing a fixed "9 AM–5 PM" template on every user, it lets individuals define their own daily rhythm — study schedules, work patterns, rest cycles — and then uses a custom-built comparison engine and generative AI to measure how well they actually followed through. The result: a personalized, data-driven feedback loop that respects how people *really* work.

---

## The Problem

Traditional productivity tools share three fundamental assumptions:

1. **Everyone works the same hours.** A student who studies best at midnight is treated identically to someone who peaks at 9 AM.
2. **Tracking is binary.** You either completed a task or didn't — there's no nuance about *when* you did it relative to your own plan.
3. **Feedback is generic.** "Be more productive" is not actionable. Users need to know *where* specifically they deviated, *how much* it cost them, and *what* to change.

These assumptions break down for students, freelancers, shift workers, and anyone whose schedule doesn't follow a cookie-cutter mold.

---

## The Solution

DeyWeaver addresses each of these gaps through six interconnected feature modules:

---

### 1. Adaptive Focus Auditor *(Core Innovation)*

This is the primary differentiator — a system that treats each user's schedule as unique and audits their actual behavior against it.

**How it works:**

| Step | What Happens | Technical Detail |
|------|-------------|-----------------|
| **Define** | User creates a 24-hour profile with categorized time blocks (focus, rest, sleep, social, etc.) | Stored as structured JSON; rendered as an interactive circular clock visualization |
| **Log** | User inputs their actual activity logs — timestamped entries with duration and activity type | JSON validation engine handles up to 200 entries, enforces ISO 8601 timestamps, validates duration bounds (1–120 min) |
| **Compare** | Engine maps every logged minute onto the planned schedule and checks for compatibility | Interval overlap algorithm with per-minute granularity; handles midnight-crossing blocks and multi-block spanning activities via automatic boundary splitting |
| **Score** | Weighted alignment score calculated based on how well actual behavior matched the plan | Compatibility matrix defines acceptable substitutions (e.g., "study" is compatible with a "focus" block); penalty weights vary by severity (social during focus = –1.0/min, idle during focus = –0.5/min) |
| **Insight** | AI generates personalized, actionable feedback | Gemini AI analyzes the audit results and produces natural-language suggestions; rule-based fallback ensures insights are always available |

**Why it matters:**
- Respects individual chronotypes and schedules instead of imposing rigid norms
- Provides granular, minute-level analysis — not just "you were productive today"
- The weighted scoring system distinguishes between *types* of deviation (scrolling Instagram during study time is worse than being idle)
- AI insights bridge the gap between raw data and actionable self-improvement

**Edge cases handled:**
- Activities spanning two or more profile blocks are automatically split at boundaries
- Midnight-crossing blocks (e.g., sleep from 10 PM to 6 AM) wrap correctly across the day boundary
- Unscheduled time periods don't penalize the user — only covered blocks count toward scoring

---

### 2. AI Schedule Generation

Users describe their day in natural language (*"I have a morning lecture at 10, gym at 5, and need to finish a project report by tomorrow"*), and Gemini AI generates a structured, time-blocked schedule.

**Impact:** Eliminates the barrier to entry for planning. Users who struggle with blank-slate scheduling get an intelligent starting point they can refine.

**Technical approach:** Genkit flow with structured input/output schemas (Zod validation), prompt engineering that accounts for task urgency, deadlines, estimated durations, and preferred work patterns.

---

### 3. Intelligent Task Breakdown

Given a large task and its deadline, the AI decomposes it into manageable sub-tasks with time estimates and priority ordering.

**Impact:** Addresses procrastination caused by task overwhelm — large projects become sequences of small, achievable steps.

**Example:** *"Complete database project report by April 15"* → Sub-tasks: Research (2h), Schema Design (1.5h), Query Writing (2h), Documentation (1h), Review (30min).

---

### 4. Dynamic Task Reallocation

When the user's day goes off-plan (meeting overruns, unexpected errand, feeling unwell), they describe the disruption and the AI redistributes remaining tasks across available time slots.

**Impact:** Plans survive contact with reality. Instead of abandoning the entire schedule when one thing goes wrong, the system adapts around the disruption.

---

### 5. Productivity Analytics Dashboard

A suite of five analytics widgets that give the user a comprehensive view of their productivity patterns:

| Widget | What It Shows | How It's Built |
|--------|--------------|----------------|
| **Task Progress** | Completion status distribution (pie chart) | Recharts PieChart, data from localStorage |
| **Life Balance** | Task distribution across life categories — Work, Health, Relationships, Growth, Fun, Finance, Home | AI categorization with keyword-based fallback; Recharts visualization |
| **Efficiency Score** | AI-generated 0–100 score based on completion rates, overdue items, and priority handling | Genkit flow → Gemini analysis |
| **Burnout Predictor** | Risk level (Low/Medium/High) with contributing factors | AI analyzes workload density, overdue patterns, and blocked tasks |
| **Time Usage** | Weekly breakdown of hours spent across activity categories | Stacked bar chart, AI-analyzed from task history |

**Impact:** Transforms scattered task data into self-awareness. Users can spot patterns (e.g., consistently neglecting health tasks, overloading Mondays) and course-correct before burnout.

---

### 6. Meeting & Speech Preparation

Users input an upcoming calendar event alongside their current task list. The AI adjusts the schedule to accommodate preparation time, generates a pre-meeting checklist, and compresses lower-priority tasks.

**Impact:** Reduces context-switching anxiety — presentation prep and schedule adjustment happen in one step instead of manual reshuffling.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│   Next.js 15 (App Router) + React 18 + TypeScript   │
│   ShadCN UI Components + Tailwind CSS + Recharts    │
├─────────────────────────────────────────────────────┤
│                   AI Layer                           │
│   Google Genkit → Gemini 2.5 Flash Lite             │
│   9 AI flows: Schedule, Breakdown, Reallocation,    │
│   Efficiency, Burnout, Life Balance, Time Usage,    │
│   Focus Insights, Email Summarization               │
├─────────────────────────────────────────────────────┤
│                 Data Layer                           │
│   Firebase Auth (Email/Google/GitHub)                │
│   localStorage for tasks, profiles, audit results   │
├─────────────────────────────────────────────────────┤
│              Core Engine (Client-Side)               │
│   Focus Auditor: 1440-minute baseline array,         │
│   interval overlap, compatibility matrix,            │
│   weighted scoring, midnight handling                │
└─────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Client-side comparison engine** | Scoring logic is deterministic and fast — no need for a round-trip to the server. Runs in <50ms even with 200 log entries. |
| **AI for insights, not scoring** | The score must be reproducible and explainable. AI handles the squishy part (natural-language feedback), while math handles the precise part (alignment percentage). |
| **1440-minute baseline array** | Each minute of the day maps to a category. O(1) lookup per minute during comparison. Simple, fast, handles all edge cases uniformly. |
| **Compatibility matrix** | Not all mismatches are equal. Studying during a "focus" block shouldn't penalize you — the matrix defines acceptable substitutions per block type. |
| **localStorage persistence** | No backend database needed for MVP. Profile and logs persist across sessions. Follows the existing DeyWeaver pattern for task storage. |

---

## Impact & Innovation Summary

| Dimension | How DeyWeaver Addresses It |
|-----------|---------------------------|
| **Personalization** | No fixed schedule assumptions — every user defines their own 24h rhythm |
| **Precision** | Per-minute comparison with weighted scoring, not binary pass/fail |
| **Actionability** | AI doesn't just score — it tells you *what* to change and *where* to move activities |
| **Resilience** | Dynamic reallocation means plans survive disruptions instead of being abandoned |
| **Self-awareness** | Analytics dashboard reveals patterns the user can't see from individual task lists |
| **Accessibility** | Natural-language schedule creation removes the friction of manual time-blocking |
| **Edge-case robustness** | Midnight crossings, multi-block activities, boundary splitting — handled automatically |

---

## Use Cases

| User | Scenario | DeyWeaver Feature |
|------|----------|-------------------|
| **College student** | Studies best at night, sleeps late, has irregular lecture schedule | Focus Auditor with custom night-owl profile |
| **Freelancer** | Works in short bursts between client calls, needs to track focus time | Activity log input + deviation report |
| **Professional** | Wants to balance work, exercise, and family time across the week | Life Balance chart + AI burnout prediction |
| **Exam season student** | Has a huge syllabus to cover in 10 days | Intelligent task breakdown + schedule generation |
| **Anyone** | Plan goes wrong mid-day (unexpected meeting, errand) | Dynamic task reallocation |

---

## API Integration

DeyWeaver integrates with **Google Gemini** (via the Genkit framework) across 9 distinct AI flows, each with:
- **Typed input/output schemas** (Zod validation) ensuring structured, predictable AI responses
- **Fallback handling** — every flow degrades gracefully if the AI service is unavailable
- **Prompt engineering** — each flow has a purpose-built prompt with domain-specific instructions

Additional API integrations:
- **Open-Meteo** — Weather data for dashboard context
- **ZenQuotes** — Daily motivational quotes
- **Reddit World News** — Top headlines for quick awareness
- **Firebase Auth** — Secure authentication with multiple providers

---

*DeyWeaver doesn't just help you plan your day — it helps you understand how you actually spend it, and what to do differently tomorrow.*
