import { CalendarEvent, EVENT_TYPE_COLORS } from "@/types/calendar";
import { format, isSameDay, isToday, getHours, getMinutes } from "date-fns";
import { cn } from "@/lib/utils";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const DayView = ({ currentDate, events, onEventClick }: DayViewProps) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const dayEvents = events.filter(event => isSameDay(event.startDateTime, currentDate));

  const getEventsForHour = (hour: number) => {
    return dayEvents.filter(event => {
      const eventHour = getHours(event.startDateTime);
      return eventHour === hour;
    });
  };

  const getEventPosition = (event: CalendarEvent) => {
    const startMinutes = getMinutes(event.startDateTime);
    const top = (startMinutes / 60) * 100;
    return { top: `${top}%` };
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden h-full flex flex-col">
      {/* Day Header */}
      <div className={cn(
        "py-4 text-center border-b border-border",
        isToday(currentDate) && "bg-primary/10"
      )}>
        <div className="text-sm text-muted-foreground">{format(currentDate, 'EEEE')}</div>
        <div className={cn(
          "text-3xl font-serif font-semibold",
          isToday(currentDate) ? "text-primary" : "text-foreground"
        )}>
          {format(currentDate, 'MMMM d, yyyy')}
        </div>
      </div>

      {/* All-day events */}
      {dayEvents.filter(e => e.allDay).length > 0 && (
        <div className="border-b border-border p-2 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">All day</div>
          <div className="flex flex-wrap gap-2">
            {dayEvents.filter(e => e.allDay).map(event => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className={cn(
                  "px-3 py-1 rounded text-sm text-white hover:opacity-80 transition-opacity",
                  EVENT_TYPE_COLORS[event.type]
                )}
              >
                {event.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time Labels */}
          <div className="w-20 flex-shrink-0">
            {hours.map((hour) => (
              <div key={hour} className="h-20 border-b border-border flex items-start justify-end pr-3 pt-1">
                <span className="text-sm text-muted-foreground">
                  {format(new Date().setHours(hour, 0), 'h:mm a')}
                </span>
              </div>
            ))}
          </div>

          {/* Events Column */}
          <div className="flex-1 border-l border-border relative">
            {hours.map((hour) => {
              const hourEvents = getEventsForHour(hour);
              return (
                <div key={hour} className="h-20 border-b border-border relative">
                  {hourEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      style={getEventPosition(event)}
                      className={cn(
                        "absolute left-2 right-2 px-3 py-2 rounded-lg text-sm text-white hover:opacity-80 transition-opacity z-10",
                        EVENT_TYPE_COLORS[event.type]
                      )}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="text-xs opacity-80">
                        {format(event.startDateTime, 'h:mm a')} - {format(event.endDateTime, 'h:mm a')}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
