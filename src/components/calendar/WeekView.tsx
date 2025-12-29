import { CalendarEvent, EVENT_TYPE_COLORS } from "@/types/calendar";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  eachHourOfInterval, 
  startOfDay,
  endOfDay,
  isSameDay,
  isToday,
  getHours,
  getMinutes
} from "date-fns";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const WeekView = ({ currentDate, events, onEventClick }: WeekViewProps) => {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return events.filter(event => {
      if (!isSameDay(event.startDateTime, day)) return false;
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
      {/* Day Headers */}
      <div className="grid grid-cols-8 border-b border-border">
        <div className="w-16" /> {/* Time column spacer */}
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "py-3 text-center border-l border-border",
              isToday(day) && "bg-primary/10"
            )}
          >
            <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
            <div className={cn(
              "text-xl font-semibold",
              isToday(day) ? "text-primary" : "text-foreground"
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8">
          {/* Time Labels */}
          <div className="w-16">
            {hours.map((hour) => (
              <div key={hour} className="h-16 border-b border-border flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-muted-foreground">
                  {format(new Date().setHours(hour, 0), 'ha')}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {days.map((day) => (
            <div key={day.toISOString()} className="border-l border-border relative">
              {hours.map((hour) => {
                const hourEvents = getEventsForDayAndHour(day, hour);
                return (
                  <div key={hour} className="h-16 border-b border-border relative">
                    {hourEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        style={getEventPosition(event)}
                        className={cn(
                          "absolute left-1 right-1 px-2 py-1 rounded text-xs text-white truncate hover:opacity-80 transition-opacity z-10",
                          EVENT_TYPE_COLORS[event.type]
                        )}
                      >
                        {event.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
