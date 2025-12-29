import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarEventType, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface CalendarSidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  onCreateEvent: () => void;
  filters: Record<CalendarEventType, boolean>;
  onFilterChange: (filters: Record<CalendarEventType, boolean>) => void;
}

const CalendarSidebar = ({
  currentDate,
  onDateSelect,
  onCreateEvent,
  filters,
  onFilterChange,
}: CalendarSidebarProps) => {
  const eventTypes: CalendarEventType[] = [
    'job',
    'outreach',
    'interview',
    'coffee-chat',
    'follow-up',
    'relationship',
    'personal',
  ];

  const toggleFilter = (type: CalendarEventType) => {
    onFilterChange({
      ...filters,
      [type]: !filters[type],
    });
  };

  return (
    <aside className="w-64 border-r border-border bg-card p-4 flex flex-col gap-4">
      {/* Create Event Button */}
      <Button 
        onClick={onCreateEvent}
        className="w-full gap-2"
      >
        <Plus className="w-4 h-4" />
        Create event
      </Button>

      {/* Mini Calendar */}
      <div className="bg-muted/50 rounded-xl p-2">
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={(date) => date && onDateSelect(date)}
          className="pointer-events-auto"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground mb-2">Filters</h3>
        {eventTypes.map((type) => (
          <label
            key={type}
            className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
          >
            <Checkbox
              checked={filters[type]}
              onCheckedChange={() => toggleFilter(type)}
            />
            <span className={cn("w-3 h-3 rounded-full", EVENT_TYPE_COLORS[type])} />
            <span className="text-sm text-foreground">{EVENT_TYPE_LABELS[type]}</span>
          </label>
        ))}
      </div>
    </aside>
  );
};

export default CalendarSidebar;
