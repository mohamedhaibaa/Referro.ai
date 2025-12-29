import { useState } from "react";
import { 
  CalendarEvent, 
  CalendarEventType, 
  CalendarView,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS 
} from "@/types/calendar";
import { mockCalendarEvents } from "@/data/calendarEvents";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import AgendaView from "@/components/calendar/AgendaView";
import EventDetailsPanel from "@/components/calendar/EventDetailsPanel";
import Sidebar from "@/components/Sidebar";

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [events, setEvents] = useState<CalendarEvent[]>(mockCalendarEvents);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filters, setFilters] = useState<Record<CalendarEventType, boolean>>({
    'job': true,
    'outreach': true,
    'interview': true,
    'coffee-chat': true,
    'follow-up': true,
    'relationship': true,
    'personal': true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredEvents = events.filter(event => {
    if (!filters[event.type]) return false;
    if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const goToToday = () => setCurrentDate(new Date());

  const handleCreateEvent = () => {
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: 'New Event',
      type: 'personal',
      startDateTime: new Date(),
      endDateTime: new Date(Date.now() + 60 * 60 * 1000),
      allDay: false,
      recurrenceRule: 'none',
      reminders: [{ minutesBefore: 60 }],
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
      timezone: 'America/Halifax',
    };
    setSelectedEvent(newEvent);
    setIsCreating(true);
  };

  const handleSaveEvent = (updatedEvent: CalendarEvent) => {
    if (isCreating) {
      setEvents([...events, updatedEvent]);
    } else {
      setEvents(events.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    }
    setSelectedEvent(null);
    setIsCreating(false);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter(e => e.id !== eventId));
    setSelectedEvent(null);
    setIsCreating(false);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsCreating(false);
  };

  const renderView = () => {
    const viewProps = {
      currentDate,
      events: filteredEvents,
      onEventClick: handleEventClick,
    };

    switch (view) {
      case 'month':
        return <MonthView {...viewProps} />;
      case 'week':
        return <WeekView {...viewProps} />;
      case 'day':
        return <DayView {...viewProps} />;
      case 'agenda':
        return <AgendaView {...viewProps} />;
      default:
        return <MonthView {...viewProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <div className="ml-20 flex flex-1">
        {/* Calendar Left Sidebar */}
        <CalendarSidebar
          currentDate={currentDate}
          onDateSelect={setCurrentDate}
          onCreateEvent={handleCreateEvent}
          filters={filters}
          onFilterChange={setFilters}
        />

        {/* Main Calendar Area */}
        <div className="flex-1 flex flex-col">
          <CalendarHeader
            currentDate={currentDate}
            view={view}
            onViewChange={setView}
            onNavigate={setCurrentDate}
            onToday={goToToday}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          
          <div className="flex-1 overflow-auto p-4">
            {renderView()}
          </div>
        </div>

        {/* Event Details Panel */}
        {selectedEvent && (
          <EventDetailsPanel
            event={selectedEvent}
            isNew={isCreating}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            onClose={() => {
              setSelectedEvent(null);
              setIsCreating(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Calendar;
