import { ChevronLeft, ChevronRight, Search, CalendarDays } from "lucide-react";
import { CalendarView } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (date: Date) => void;
  onToday: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const CalendarHeader = ({
  currentDate,
  view,
  onViewChange,
  onNavigate,
  onToday,
  searchQuery,
  onSearchChange,
}: CalendarHeaderProps) => {
  const views: { value: CalendarView; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' },
    { value: 'agenda', label: 'Agenda' },
  ];

  const navigatePrev = () => {
    switch (view) {
      case 'month':
        onNavigate(subMonths(currentDate, 1));
        break;
      case 'week':
        onNavigate(subWeeks(currentDate, 1));
        break;
      case 'day':
        onNavigate(subDays(currentDate, 1));
        break;
      case 'agenda':
        onNavigate(subMonths(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case 'month':
        onNavigate(addMonths(currentDate, 1));
        break;
      case 'week':
        onNavigate(addWeeks(currentDate, 1));
        break;
      case 'day':
        onNavigate(addDays(currentDate, 1));
        break;
      case 'agenda':
        onNavigate(addMonths(currentDate, 1));
        break;
    }
  };

  const getDateLabel = () => {
    switch (view) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        return format(currentDate, "'Week of' MMMM d, yyyy");
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'agenda':
        return format(currentDate, 'MMMM yyyy');
    }
  };

  return (
    <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-serif font-semibold text-foreground">Calendar</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-lg font-medium text-foreground min-w-[200px]">
            {getDateLabel()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-64"
          />
        </div>

        {/* View Selector */}
        <div className="flex items-center bg-muted rounded-lg p-1">
          {views.map((v) => (
            <Button
              key={v.value}
              variant={view === v.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange(v.value)}
              className="text-sm"
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default CalendarHeader;
