'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { normalizeStoredTasks } from '@/lib/task-storage';
import { stripUndefined } from '@/lib/firebase-utils';
import type { Task } from '@/types';

interface TasksContextType {
  tasks: Task[];
  auditHistory: any[]; // we vibin this works
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>; // Support legacy set state if needed
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  isLoading: boolean;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync with Firestore in real-time
  useEffect(() => {
    if (!user?.uid) {
      setTasksState([]); // Clear tasks if no user
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    setIsLoading(true);
    const ref = doc(db, 'userPreferences', user.uid);
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      console.log(`[TasksProvider] Snapshot received for ${user.uid}. Exists: ${snapshot.exists()}`);
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log("[TasksProvider] Raw data keys:", Object.keys(data));
        const dbTasks = normalizeStoredTasks(data?.userTasks);
        console.log(`[TasksProvider] Normalized ${dbTasks.length} tasks.`);
        setTasksState(dbTasks);
        setAuditHistory(data?.auditHistory || []);
      } else {
        setTasksState([]); // Reset to empty if doc missing
        setAuditHistory([]);
      }
      setIsLoading(false);
      setIsInitialized(true);
    }, (error) => {
      console.error("[TasksProvider] Firestore sync error:", error);
      setIsLoading(false);
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const saveToDb = useCallback(async (newTasks: Task[]) => {
    if (user?.uid) {
      const ref = doc(db, 'userPreferences', user.uid);
      await setDoc(ref, { userTasks: stripUndefined(newTasks) }, { merge: true });
    }
  }, [user?.uid]);

  const addTask = async (task: Task) => {
    const updated = [task, ...tasks];
    setTasksState(updated);
    await saveToDb(updated);
  };

  const updateTask = async (task: Task) => {
    const updated = tasks.map(t => t.id === task.id ? task : t);
    setTasksState(updated);
    await saveToDb(updated);
  };

  const deleteTask = async (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasksState(updated);
    await saveToDb(updated);
  };

  // Wrapped setter for legacy components using setTasks directly
  const setTasks = (val: React.SetStateAction<Task[]>) => {
    const nextTasks = typeof val === 'function' ? val(tasks) : val;
    setTasksState(nextTasks);
    saveToDb(nextTasks);
  };

  return (
    <TasksContext.Provider value={{ tasks, auditHistory, setTasks, addTask, updateTask, deleteTask, isLoading: isLoading || !isInitialized }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
}
