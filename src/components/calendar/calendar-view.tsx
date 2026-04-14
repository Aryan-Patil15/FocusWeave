
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ImportantDate } from '@/types';
import { useImportantDates } from '@/contexts/important-dates-context';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Star, PlusCircle, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export function CalendarView() {
  const { user } = useAuth();
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date | undefined>(new Date());
  const { importantDates, addImportantDate, removeImportantDate, isLoading } = useImportantDates();
  const [isImportantDateModalOpen, setIsImportantDateModalOpen] = useState(false);
  const [newImportantDateDesc, setNewImportantDateDesc] = useState('');
  const [newImportantDateDate, setNewImportantDateDate] = useState<Date | undefined>(new Date());
  const [newImportantDateTime, setNewImportantDateTime] = useState('12:00');

  const { toast } = useToast();

  const importantDatesByDay = useMemo(() => {
    const map = new Map<string, ImportantDate[]>();
    importantDates.forEach(impDate => {
      if (impDate.date && isValid(parseISO(impDate.date))) {
        const dayStr = format(parseISO(impDate.date), 'yyyy-MM-dd');
        if (!map.has(dayStr)) {
          map.set(dayStr, []);
        }
        map.get(dayStr)?.push(impDate);
      }
    });
    return map;
  }, [importantDates]);

  const selectedDayItems: ImportantDate[] = useMemo(() => {
    if (!currentCalendarDate) return [];
    const dayStr = format(currentCalendarDate, 'yyyy-MM-dd');
    return importantDatesByDay.get(dayStr) || [];
  }, [currentCalendarDate, importantDatesByDay]);

  const calendarModifiers = useMemo(() => {
    const modifiers: Record<string, Date[]> = {
      important: [],
    };
    importantDates.forEach(impDate => {
       if (impDate.date && isValid(parseISO(impDate.date))) {
        modifiers.important.push(startOfDay(parseISO(impDate.date)));
       }
    });
    return modifiers;
  }, [importantDates]);

  const calendarModifierStyles = {
    important: { borderColor: 'hsl(var(--accent))', borderWidth: '2px', borderRadius: 'var(--radius)' }
  };

  const handleAddImportantDate = async () => {
    if (!newImportantDateDesc.trim() || !newImportantDateDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide a description and select a date for the important event.',
      });
      return;
    }
    const [hours, minutes] = newImportantDateTime.split(':').map(Number);
    const dateWithTime = new Date(newImportantDateDate);
    dateWithTime.setHours(hours, minutes, 0, 0);

    const newDate: ImportantDate = {
      id: `imp-${Date.now()}`,
      date: dateWithTime.toISOString(),
      description: newImportantDateDesc.trim(),
      type: 'importantDate',
    };
    await addImportantDate(newDate);
    toast({
      title: 'Important Date Added',
      description: `"${newDate.description}" on ${format(dateWithTime, 'PPP p')} added.`,
    });
    setIsImportantDateModalOpen(false);
    setNewImportantDateDesc('');
    setNewImportantDateDate(new Date());
    setNewImportantDateTime('12:00');
  };

  const handleDeleteDate = async (id: string, description: string) => {
    await removeImportantDate(id);
    toast({
      title: 'Date Deleted',
      description: `"${description}" has been removed.`,
    });
  };
  
  if (isLoading) {
    return <div className="text-center p-8">Loading calendar...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Important Dates Calendar</CardTitle>
           <Dialog open={isImportantDateModalOpen} onOpenChange={setIsImportantDateModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Important Date
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Important Date</DialogTitle>
                <DialogDescription>
                  Specify the date and description for your important event.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="impDateDesc" className="text-right">Description</Label>
                  <Input 
                    id="impDateDesc" 
                    value={newImportantDateDesc} 
                    onChange={(e) => setNewImportantDateDesc(e.target.value)} 
                    className="col-span-3" 
                    placeholder="e.g., Mom's Birthday"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="impDateDate" className="text-right">Date</Label>
                  <div className="col-span-3">
                    <Calendar
                        mode="single"
                        selected={newImportantDateDate}
                        onSelect={setNewImportantDateDate}
                        initialFocus
                        className="rounded-md border p-0 [&_button]:h-8 [&_button]:w-8 [&_caption_label]:text-sm [&_caption_label]:font-medium"
                      />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="impDateTime" className="text-right">Time</Label>
                  <Input 
                    id="impDateTime" 
                    type="time"
                    value={newImportantDateTime} 
                    onChange={(e) => setNewImportantDateTime(e.target.value)} 
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportantDateModalOpen(false)}>Cancel</Button>
                <Button onClick={handleAddImportantDate}>Add Date</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <Calendar
            mode="single"
            selected={currentCalendarDate}
            onSelect={setCurrentCalendarDate}
            className="rounded-md border w-full"
            modifiers={calendarModifiers}
            modifiersStyles={calendarModifierStyles}
            footer={
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs p-2 border-t">
                <div className="flex items-center"><span className="h-3 w-3 rounded-md border-2 mr-1.5" style={{borderColor: calendarModifierStyles.important.borderColor}}></span> Important Date</div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card className="shadow-lg h-fit">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="h-6 w-6 mr-2 text-primary" />
            Events for {currentCalendarDate ? format(currentCalendarDate, 'PPP') : 'Selected Day'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDayItems.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-20rem)] max-h-[450px] pr-3">
              <ul className="space-y-3">
                {selectedDayItems.map(item => (
                  <li key={item.id} className="p-3 bg-muted/50 rounded-md shadow-sm group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4 text-accent flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-accent-foreground">{item.description}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center mt-0.5">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(parseISO(item.date), 'p')}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteDate(item.id, item.description)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {currentCalendarDate ? "No important dates for this day." : "Select a day to see important dates."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
