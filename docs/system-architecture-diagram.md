# FocusWeave System Architecture

This diagram reflects the current implementation in the repository.

```mermaid
flowchart TB
    user[End User]

    subgraph client["Client Layer - Next.js App Router / React"]
        authPages["Auth Pages
        /login /signup"]
        appPages["Authenticated Pages
        Dashboard
        Tasks
        Analytics
        Schedule
        Reallocate
        Breakdown
        Meeting Prep
        Calendar
        Focus Auditor
        Settings"]
        providers["Client Providers
        ThemeProvider
        QueryClientProvider
        AuthProvider
        TasksProvider
        ImportantDatesProvider
        SettingsProvider"]
        widgets["Feature Components
        Dashboard widgets
        Task forms
        Charts
        Focus Auditor workspace"]
    end

    subgraph browser["Browser Storage / Runtime"]
        localStorage["localStorage
        Focus Auditor plan/logs/results
        Reward profile
        Theme preference"]
        geo["Browser Geolocation API"]
    end

    subgraph server["Server Layer - Next.js Server Actions"]
        actions["src/lib/actions.ts
        AI handlers
        Weather
        Quote
        News"]
    end

    subgraph ai["AI Layer - Genkit"]
        genkit["src/ai/genkit.ts
        Genkit runtime"]
        flows["AI Flows
        create-schedule
        breakdown
        reallocation
        meeting-aware
        burnout
        efficiency
        life-balance
        time-usage
        focus insights
        news curation
        task alignment audit"]
        gemini["Google Gemini
        gemini-2.5-flash-lite"]
    end

    subgraph data["Data Layer - Firebase"]
        auth["Firebase Auth
        Email / Google / GitHub"]
        firestore["Cloud Firestore
        users
        userPreferences
        userTasks
        importantDates
        dashboard/settings
        auditHistory"]
    end

    subgraph engines["Domain Logic"]
        focusEngine["Focus Auditor Engine
        validation
        minute maps
        scoring
        deviations
        fallback insights"]
        behavior["Behavior Intelligence
        cognitive state
        loop detection
        reward signals"]
    end

    subgraph external["External Services"]
        weather["Open-Meteo
        weather + geocoding"]
        quotes["ZenQuotes"]
        googleNews["Google News RSS"]
    end

    user --> authPages
    user --> appPages
    authPages --> providers
    appPages --> providers
    providers --> widgets

    widgets --> focusEngine
    widgets --> behavior
    widgets --> localStorage
    widgets --> actions
    widgets --> auth
    widgets --> firestore
    geo --> widgets

    actions --> genkit
    genkit --> flows
    flows --> gemini

    actions --> weather
    actions --> quotes
    actions --> googleNews

    providers --> auth
    providers --> firestore
    focusEngine --> localStorage
    behavior --> localStorage
    firestore --> providers
    firestore --> widgets
```

## Main Data Flows

1. Users interact with Next.js pages and client components.
2. React providers manage auth, task state, settings, and important dates.
3. Firebase Auth authenticates users; Firestore persists user profile, tasks, settings, dates, and audit history.
4. Server actions broker AI requests and external data fetches.
5. Genkit flows call Gemini for planning, analytics, and audit-style features.
6. The Focus Auditor also performs local scoring and behavior analysis in-browser, with localStorage used for fast persistence and Firestore used for history sync.
