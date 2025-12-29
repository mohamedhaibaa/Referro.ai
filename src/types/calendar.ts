export type CalendarEventType = 
  | 'job'
  | 'outreach'
  | 'interview'
  | 'coffee-chat'
  | 'follow-up'
  | 'relationship'
  | 'personal';

export type CalendarEventStatus = 'scheduled' | 'done' | 'canceled';

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface CalendarReminder {
  minutesBefore: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDateTime: Date;
  endDateTime: Date;
  allDay: boolean;
  recurrenceRule: RecurrenceRule;
  reminders: CalendarReminder[];
  linkedJobId?: string;
  linkedContactId?: string;
  notes?: string;
  suggestedMessageTemplate?: string;
  status: CalendarEventStatus;
  createdAt: Date;
  updatedAt: Date;
  timezone: string;
}

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  'job': 'bg-[hsl(220,80%,55%)]',
  'outreach': 'bg-[hsl(160,60%,45%)]',
  'interview': 'bg-[hsl(270,70%,60%)]',
  'coffee-chat': 'bg-[hsl(35,90%,55%)]',
  'follow-up': 'bg-[hsl(45,100%,55%)]',
  'relationship': 'bg-[hsl(320,70%,60%)]',
  'personal': 'bg-[hsl(200,60%,55%)]',
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  'job': 'Jobs',
  'outreach': 'Outreach',
  'interview': 'Interviews',
  'coffee-chat': 'Coffee Chats',
  'follow-up': 'Follow-ups',
  'relationship': 'Relationship',
  'personal': 'Personal',
};
