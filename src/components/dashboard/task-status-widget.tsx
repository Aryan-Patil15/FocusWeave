"use client";

import { useEffect, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTasksFromLocalStorage } from '@/lib/task-storage';
import { CheckCircle2 } from 'lucide-react';
import type { Task } from '@/types';

const COLORS = {
  todo: '#cbd5e1',     // slate-300
  inprogress: '#3b82f6', // blue-500
  done: '#22c55e',      // green-500
  blocked: '#ef4444'    // red-500
};

export function TaskStatusWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Load tasks on mount
    setTasks(getTasksFromLocalStorage());

    // Listen for cross-tab or global updates
    const handleTasksUpdated = () => {
      setTasks(getTasksFromLocalStorage());
    };

    window.addEventListener('focusweave-tasks-updated', handleTasksUpdated);
    return () => {
      window.removeEventListener('focusweave-tasks-updated', handleTasksUpdated);
    };
  }, []);

  const stats = {
    todo: tasks.filter(t => t.status === 'todo').length,
    inprogress: tasks.filter(t => t.status === 'inprogress').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  };

  const data = [
    { name: 'To Do', value: stats.todo, color: COLORS.todo, id: 'todo' },
    { name: 'In Progress', value: stats.inprogress, color: COLORS.inprogress, id: 'inprogress' },
    { name: 'Done', value: stats.done, color: COLORS.done, id: 'done' },
    { name: 'Blocked', value: stats.blocked, color: COLORS.blocked, id: 'blocked' }
  ].filter(item => item.value > 0);

  if (tasks.length === 0) {
    return (
        <Card className="h-full border-border/80 shadow-sm flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Task Status
                </CardTitle>
                <CardDescription>Overview of your task progress</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex items-center justify-center">
                <div className="flex flex-col items-center justify-center p-6 border rounded-full aspect-square border-dashed opacity-50">
                   <p className="text-muted-foreground text-sm">No tasks</p>
                </div>
            </CardContent>
        </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-sm z-50 relative">
          <p className="font-semibold">{payload[0].name}</p>
          <p>{payload[0].value} tasks</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full border-border/80 shadow-sm flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Task Status
        </CardTitle>
        <CardDescription>Overview of your task progress</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value, entry: any) => <span className="text-foreground ml-1">{value} ({entry.payload.value})</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
