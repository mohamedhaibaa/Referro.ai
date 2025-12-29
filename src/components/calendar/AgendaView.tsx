import { CalendarEvent, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/types/calendar";
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, compareAsc } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, MapPin, User, Briefcase } from "lucide-react";

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const AgendaView = ({ currentDate, events, onEventClick }: AgendaViewProps) => {
  // Group events by date category
  const sortedEvents = [...events]
    .filter(e => e.status !== 'canceled')
    .sort((a, b) => compareAsc(a.startDateTime, b.startDateTime));

  const groupEvents = () => {
    const groups: { label: string; events: CalendarEvent[] }[] = [
      { label: 'Today', events: [] },
      { label: 'Tomorrow', events: [] },
      { label: 'This Week', events: [] },
      { label: 'This Month', events: [] },
      { label: 'Later', events: [] },
    ];

    sortedEvents.forEach(event => {
      const date = event.startDateTime;
      if (isToday(date)) {
        groups[0].events.push(event);
      } else if (isTomorrow(date)) {
        groups[1].events.push(event);
      } else if (isThisWeek(date)) {
        groups[2].events.push(event);
      } else if (isThisMonth(date)) {
        groups[3].events.push(event);
      } else {
        groups[4].events.push(event);
      }
    });

    return groups.filter(g => g.events.length > 0);
  };

  const groupedEvents = groupEvents();

  if (sortedEvents.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <div className="text-muted-foreground">No upcoming events</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => (
        <div key={group.label}>
          <h3 className="text-lg font-serif font-semibold text-foreground mb-3">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.events.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full bg-card rounded-xl border border-border p-4 flex items-start gap-4 hover:border-primary/50 transition-colors text-left"
              >
                {/* Color indicator */}
                <div className={cn("w-1 h-full min-h-[60px] rounded-full", EVENT_TYPE_COLORS[event.type])} />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium text-white",
                      EVENT_TYPE_COLORS[event.type]
                    )}>
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                    {event.status === 'done' && (
                      <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                        Completed
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-semibold text-foreground">{event.title}</h4>
                  
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {event.allDay 
                        ? 'All day' 
                        : `${format(event.startDateTime, 'MMM d, h:mm a')} - ${format(event.endDateTime, 'h:mm a')}`
                      }
                    </span>
                    
                    {event.linkedJobId && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        Linked Job
                      </span>
                    )}
                    
                    {event.linkedContactId && (
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Linked Contact
                      </span>
                    )}
                  </div>
                  
                  {event.notes && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {event.notes}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgendaView;
