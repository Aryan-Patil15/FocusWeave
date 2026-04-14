![version](https://img.shields.io/badge/version-v0.0.3-orange)
# FocusWeave — Adaptive Focus Auditor

> Your day. Your goals. No stress. Let AI handle the mess.

FocusWeave is an AI-integrated productivity platform that helps users organize their day, prioritize tasks, and optimize time management through intelligent scheduling. It features the **Adaptive Focus Auditor** — a system that respects each user's unique daily rhythm, compares planned vs. actual behavior, and delivers personalized productivity insights powered by AI.

---

## Core Features

### 🎯 Adaptive Focus Auditor
The standout feature — most productivity tools assume a rigid 9-to-5 schedule. FocusWeave lets users **define their own ideal 24-hour routine** and then **audits their actual behavior** against it.

- **Custom Profile Builder** — Define your personal 24-hour schedule with time blocks for focus, study, rest, sleep, social, exercise, and more. Visualized as an interactive circular clock.
- **Activity Log Input** — Paste or upload JSON-formatted activity logs with timestamps, durations, and activity types. Built-in validation handles up to 200 entries per session.
- **Smart Comparison Engine** — Interval overlap logic precisely maps actual activities onto planned blocks, handling:
  - Activities spanning multiple profile blocks (auto-split at boundaries)
  - Midnight-crossing activities
  - Weighted penalty scoring (e.g., social media during focus time penalizes more than idle time)
- **Alignment Score** — Clear percentage score showing how well you followed your plan, with per-category breakdowns.
- **Plan vs. Actual Timeline** — Side-by-side color-coded visualization comparing your intended schedule against what actually happened.
- **Deviation Report** — Detailed table of every mismatch with exact time ranges, expected vs. actual activities, duration, and point impact.
- **AI-Powered Insights** — Gemini-generated natural-language suggestions based on your audit data (e.g., *"You spent 45 min on social media during focus time. Move it to your 5–7 PM social block."*), with rule-based fallback when AI is unavailable.

---

### 🤖 AI-Powered Schedule Creation
Describe your ideal day or goals in natural language, and let Gemini AI craft a smart, segmented schedule with balanced work and rest periods.

### ✅ Comprehensive Task Management
Create, view, update, delete, and track your daily to-dos. Filter tasks by status, priority, and search terms. Drag-and-drop organization with sub-task support.

### 🧩 Intelligent Task Breakdown
Input a large task and its deadline — AI breaks it down into manageable sub-tasks with estimated time allocations and priority ordering.

### 🔄 Dynamic Task Reallocation
Life happens. Tell AI the reason for your schedule disruption, provide your current tasks, and it intelligently reallocates them to new time slots.

### 🎤 Meeting & Speech Preparation
Input your calendar event and current tasks. AI adjusts your schedule, compresses preparation times, and generates reminders and speaker checklists.

### 📊 Productivity Analytics
- **Task Progress** — Visualize task completion status with an intuitive pie chart
- **Time Usage** — Understand how you spend time across activities with a weekly bar chart
- **AI Efficiency Score** — AI-driven score based on task completion rates, timeliness, and priorities
- **Burnout Predictor** — AI insights into work patterns to predict and help prevent burnout
- **Life Balance Chart** — Breakdown of tasks across life categories (Work, Health, Relationships, Personal Growth, etc.)

### 📬 Smart Inbox
AI-powered email summarization that extracts key points and suggests follow-up tasks from your unread emails.

### 📅 Calendar Integration
Visual calendar view with important date tracking and task scheduling overlay.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15 (App Router), React 18, TypeScript |
| **UI Components** | ShadCN UI, Radix Primitives |
| **Styling** | Tailwind CSS |
| **Generative AI** | Google Gemini (via Genkit) |
| **Authentication** | Firebase Auth (Email, Google, GitHub) |
| **State Management** | React Hook Form, TanStack Query |
| **Charting** | Recharts |
| **Fonts** | Geist Sans & Mono |

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/AnleaMJ/deyweaver.git
cd deyweaver

# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file in the root directory
echo "GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY" > .env.local
```

> Get a Google API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Running Locally

```bash
# Start the development server
npm run dev
```

The app will be available at `http://localhost:9002`.

---

## Project Structure

```
src/
├── ai/
│   ├── genkit.ts                    # Genkit AI configuration
│   └── flows/                       # AI flow definitions
│       ├── create-schedule.ts
│       ├── calculate-efficiency-score.ts
│       ├── predict-burnout.ts
│       ├── analyze-time-usage.ts
│       ├── analyze-life-balance.ts
│       ├── generate-focus-insights.ts    # Focus Auditor AI insights
│       └── ...
├── app/
│   ├── (app)/                       # Authenticated routes
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── analytics/
│   │   ├── focus-auditor/           # Adaptive Focus Auditor page
│   │   ├── schedule/
│   │   └── ...
│   └── (auth)/                      # Login/Signup
├── components/
│   ├── focus-auditor/               # Focus Auditor components
│   │   ├── profile-builder.tsx
│   │   ├── activity-log-input.tsx
│   │   ├── audit-dashboard.tsx
│   │   ├── timeline-comparison.tsx
│   │   └── deviations-insights.tsx
│   ├── analytics/
│   ├── schedule/
│   ├── tasks/
│   ├── layout/
│   └── ui/                          # ShadCN components
├── lib/
│   ├── focus-auditor-engine.ts      # Core comparison engine
│   ├── focus-auditor-storage.ts     # localStorage persistence
│   ├── actions.ts                   # Server actions
│   └── task-storage.ts
├── hooks/
└── types/
```

---

## How the Focus Auditor Works

```
1. DEFINE YOUR PLAN                    2. LOG YOUR ACTIVITY
┌────────────────────────┐             ┌────────────────────────────────────┐
│ Sleep    10 PM → 6 AM  │             │ { timestamp: "09:00",              │
│ Idle      6 AM → 9 AM  │             │   duration: 45,                    │
│ Focus     9 AM → 12 PM │             │   activity: "social" }             │
│ Rest     12 PM → 1 PM  │             │ { timestamp: "09:45",              │
│ Focus     1 PM → 5 PM  │             │   duration: 75,                    │
│ Social    5 PM → 7 PM  │             │   activity: "study" }              │
│ Rest      7 PM → 10 PM │             │ ...                                │
└────────────────────────┘             └────────────────────────────────────┘

3. GET YOUR RESULTS
╔══════════════════════════════════════╗
║     ALIGNMENT SCORE: 72/100         ║
╠══════════════════════════════════════╣
║ ✅ Focus block adherence:  82%      ║
║ ❌ Rest block adherence:   55%      ║
║ ✅ Sleep schedule:         95%      ║
╠══════════════════════════════════════╣
║ TOP DEVIATIONS:                     ║
║ • 9:00–9:45 AM: Social during Focus ║
║ • 12:30–1:00 PM: Social during Rest ║
╠══════════════════════════════════════╣
║ AI INSIGHTS:                        ║
║ • Move social media to your 5–7 PM  ║
║   social block                      ║
║ • Your afternoon focus was perfect!  ║
╚══════════════════════════════════════╝
```

### Scoring Algorithm
- Each minute is compared against the planned schedule
- **Compatible activities** earn alignment points (e.g., study during focus time ✅)
- **Incompatible activities** incur weighted penalties:
  - Social during focus: **-1.0/min** (harshest)
  - Idle during focus: **-0.5/min**
  - Sleep during exercise: **-0.2/min**
- Final score = `(aligned minutes / total tracked minutes) × 100`

---

## What Makes It Different

| Feature | Traditional Apps | FocusWeave |
|---------|-----------------|-----------|
| Schedule model | Fixed 9-to-5 | Fully personalized 24h profile |
| Activity tracking | Manual check-ins | JSON log import with validation |
| Comparison logic | Simple on/off | Interval overlap with boundary splitting |
| Midnight handling | ❌ | ✅ Auto-splits across midnight |
| Insights | Generic tips | AI-generated, context-specific suggestions |
| Scoring | Binary pass/fail | Weighted per-minute with compatibility matrix |

---

## License

This project is licensed under the [MIT License](LICENSE).

## DEMO Video

Unable to issue video link by github. Videos have been manually uploaded as "Demo1", "Demo2"



