"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { WeatherWidget } from '@/components/dashboard/weather-widget';
import { QuoteWidget } from '@/components/dashboard/quote-widget';
import { NewsWidget } from '@/components/dashboard/news-widget';
import { QuickLinksWidget } from '@/components/dashboard/quick-links-widget';
import { DirectSearchWidget } from '@/components/dashboard/direct-search-widget';
import { TaskStatusWidget } from '@/components/dashboard/task-status-widget';
import {
  getDefaultDashboardWidgetPreferences,
  loadDashboardWidgetPreferences,
  saveDashboardWidgetPreferences,
  type DashboardWidgetPreferences,
  type DashboardWidgetKey,
} from '@/lib/dashboard-preferences';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const WIDGETS: Record<DashboardWidgetKey, { component: React.ReactNode; label: string }> = {
  directSearch: { component: <DirectSearchWidget />, label: 'Direct Search' },
  weather: { component: <WeatherWidget />, label: 'Weather Forecast' },
  quote: { component: <QuoteWidget />, label: 'Quote of the Day' },
  news: { component: <NewsWidget />, label: 'Top News' },
  quickLinks: { component: <QuickLinksWidget />, label: 'Quick Links' },
  taskStatus: { component: <TaskStatusWidget />, label: 'Task Status Graph' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.trim().split(/\s+/)[0];
  const greetingName = firstName || 'there';
  
  const [widgetPreferences, setWidgetPreferences] = useState<DashboardWidgetPreferences>(
    getDefaultDashboardWidgetPreferences()
  );
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  useEffect(() => {
    let isActive = true;
    async function loadPreferences() {
      const preferences = await loadDashboardWidgetPreferences(user?.uid);
      if (isActive) {
        setWidgetPreferences(preferences);
      }
    }
    loadPreferences();
    return () => {
      isActive = false;
    };
  }, [user?.uid]);

  const moveWidget = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...widgetPreferences.widgetOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    } else {
      return;
    }
    
    const newPrefs = { ...widgetPreferences, widgetOrder: newOrder };
    setWidgetPreferences(newPrefs);
    if (user?.uid) {
      await saveDashboardWidgetPreferences(user.uid, newPrefs);
    }
  };

  const toggleWidget = async (key: DashboardWidgetKey) => {
    const newPrefs = { ...widgetPreferences, [key]: !widgetPreferences[key] };
    setWidgetPreferences(newPrefs);
    if (user?.uid) {
      await saveDashboardWidgetPreferences(user.uid, newPrefs);
    }
  };

  // Only render widgets that are marked as true and follow the widgetOrder
  const activeWidgets = widgetPreferences.widgetOrder.filter((key) => widgetPreferences[key]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader
          title={`Welcome back ${greetingName}`}
          description="Live updates and quick actions for your day."
        />
        
        <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Customize Layout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Customize Dashboard</DialogTitle>
              <DialogDescription>
                Reorder your widgets or hide the ones you don't use. Changes are saved automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              {widgetPreferences.widgetOrder.map((key, index) => {
                const isVisible = widgetPreferences[key];
                return (
                  <div 
                    key={key} 
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isVisible ? 'bg-secondary/20 border-border' : 'bg-muted/50 border-transparent opacity-70'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleWidget(key)}
                        title={isVisible ? "Hide widget" : "Show widget"}
                      >
                        {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <span className="font-medium text-sm">{WIDGETS[key].label}</span>
                      {!isVisible && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveWidget(index, 'up')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === widgetPreferences.widgetOrder.length - 1}
                        onClick={() => moveWidget(index, 'down')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {activeWidgets.map((key) => (
          <div key={key} className="w-full">
            {WIDGETS[key].component}
          </div>
        ))}
      </div>
    </div>
  );
}
