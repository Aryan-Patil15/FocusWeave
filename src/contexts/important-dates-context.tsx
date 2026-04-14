'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { stripUndefined } from '@/lib/firebase-utils';
import type { ImportantDate } from '@/types';
import { isBefore, isAfter, parseISO, startOfDay, subMinutes, differenceInMinutes, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ImportantDatesContextType {
  importantDates: ImportantDate[];
  addImportantDate: (date: ImportantDate) => Promise<void>;
  removeImportantDate: (id: string) => Promise<void>;
  isLoading: boolean;
}

const ImportantDatesContext = createContext<ImportantDatesContextType | undefined>(undefined);

export function ImportantDatesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  // Auto-delete past events
  useEffect(() => {
    if (!isInitialized || importantDates.length === 0 || !user?.uid) return;

    const today = startOfDay(new Date());
    const validDates = importantDates.filter(item => {
      const date = parseISO(item.date);
      // Keep if it's today or in the future
      return isValid(date) && !isBefore(date, today);
    });

    if (validDates.length !== importantDates.length) {
      console.log(`[ImportantDatesProvider] Auto-deleting ${importantDates.length - validDates.length} past events.`);
      const ref = doc(db, 'userPreferences', user.uid);
      updateDoc(ref, { importantDates: stripUndefined(validDates) }).catch(err => 
        console.error("Auto-delete error:", err)
      );
    }
  }, [importantDates, isInitialized, user?.uid]);

  // Notifications: 30 minutes prior
  useEffect(() => {
    if (!isInitialized || importantDates.length === 0) return;

    const checkNotifications = () => {
      const now = new Date();
      importantDates.forEach(item => {
        const eventDate = parseISO(item.date);
        if (!isValid(eventDate) || notifiedIds.has(item.id)) return;

        const minutesUntil = differenceInMinutes(eventDate, now);
        
        // Notify if exactly 30 minutes away (checking a small window of 29-30 mins just in case)
        if (minutesUntil <= 30 && minutesUntil > 0) {
          toast({
            title: "Upcoming Event",
            description: `"${item.description}" starts in ${minutesUntil} minutes!`,
          });
          setNotifiedIds(prev => new Set(prev).add(item.id));
        }
      });
    };

    const interval = setInterval(checkNotifications, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [importantDates, isInitialized, notifiedIds, toast]);

  // Sync with Firestore in real-time
  useEffect(() => {
    if (!user?.uid) {
      setImportantDates([]); // Clear if no user
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    setIsLoading(true);
    const ref = doc(db, 'userPreferences', user.uid);
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      console.log(`[ImportantDatesProvider] Snapshot received for ${user.uid}. Exists: ${snapshot.exists()}`);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const dbDates = Array.isArray(data?.importantDates) ? data.importantDates : [];
        setImportantDates(dbDates);
      } else {
        setImportantDates([]);
      }
      setIsLoading(false);
      setIsInitialized(true);
    }, (error) => {
      console.error("[ImportantDatesProvider] Important dates sync error:", error);
      setIsLoading(false);
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const addImportantDate = async (newDate: ImportantDate) => {
    const updated = [...importantDates, newDate];
    setImportantDates(updated);
    
    if (user?.uid) {
      const ref = doc(db, 'userPreferences', user.uid);
      await setDoc(ref, { importantDates: stripUndefined(updated) }, { merge: true });
    }
  };

  const removeImportantDate = async (id: string) => {
    const updated = importantDates.filter(d => d.id !== id);
    setImportantDates(updated);
    
    if (user?.uid) {
      const ref = doc(db, 'userPreferences', user.uid);
      await updateDoc(ref, { importantDates: stripUndefined(updated) });
    }
  };

  return (
    <ImportantDatesContext.Provider value={{ 
      importantDates, 
      addImportantDate, 
      removeImportantDate,
      isLoading: isLoading || !isInitialized 
    }}>
      {children}
    </ImportantDatesContext.Provider>
  );
}

export function useImportantDates() {
  const context = useContext(ImportantDatesContext);
  if (context === undefined) {
    throw new Error('useImportantDates must be used within an ImportantDatesProvider');
  }
  return context;
}
