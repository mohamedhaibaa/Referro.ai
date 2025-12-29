import { useState } from "react";
import { 
  CalendarEvent, 
  CalendarEventType, 
  RecurrenceRule,
  EVENT_TYPE_COLORS, 
  EVENT_TYPE_LABELS 
} from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  X, 
  Trash2, 
  Save, 
  Copy, 
  ExternalLink, 
  Check,
  Clock,
  Bell,
  Link,
  FileText,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EventDetailsPanelProps {
  event: CalendarEvent;
  isNew: boolean;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
}

const EventDetailsPanel = ({
  event,
  isNew,
  onSave,
  onDelete,
  onClose,
}: EventDetailsPanelProps) => {
  const { toast } = useToast();
  const [editedEvent, setEditedEvent] = useState<CalendarEvent>(event);
  const [copied, setCopied] = useState(false);

  const eventTypes: CalendarEventType[] = [
    'job',
    'outreach',
    'interview',
    'coffee-chat',
    'follow-up',
    'relationship',
    'personal',
  ];

  const recurrenceOptions: { value: RecurrenceRule; label: string }[] = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const reminderOptions = [
    { value: 10, label: '10 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 1440, label: '1 day before' },
  ];

  const handleSave = () => {
    onSave({ ...editedEvent, updatedAt: new Date() });
    toast({ title: isNew ? "Event created!" : "Event saved!" });
  };

  const handleDelete = () => {
    onDelete(editedEvent.id);
    toast({ title: "Event deleted" });
  };

  const handleMarkDone = () => {
    setEditedEvent({ ...editedEvent, status: 'done' });
    onSave({ ...editedEvent, status: 'done', updatedAt: new Date() });
    toast({ title: "Marked as done!" });
  };

  const handleCopyMessage = () => {
    if (editedEvent.suggestedMessageTemplate) {
      navigator.clipboard.writeText(editedEvent.suggestedMessageTemplate);
      setCopied(true);
      toast({ title: "Message copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDateTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-serif font-semibold text-foreground">
          {isNew ? 'New Event' : 'Event Details'}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={editedEvent.title}
            onChange={(e) => setEditedEvent({ ...editedEvent, title: e.target.value })}
            placeholder="Event title"
          />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={editedEvent.type}
            onValueChange={(value: CalendarEventType) => setEditedEvent({ ...editedEvent, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full", EVENT_TYPE_COLORS[type])} />
                    {EVENT_TYPE_LABELS[type]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date/Time */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Start
          </Label>
          <Input
            type="datetime-local"
            value={formatDateTime(editedEvent.startDateTime)}
            onChange={(e) => setEditedEvent({ 
              ...editedEvent, 
              startDateTime: new Date(e.target.value) 
            })}
          />
        </div>

        <div className="space-y-2">
          <Label>End</Label>
          <Input
            type="datetime-local"
            value={formatDateTime(editedEvent.endDateTime)}
            onChange={(e) => setEditedEvent({ 
              ...editedEvent, 
              endDateTime: new Date(e.target.value) 
            })}
          />
        </div>

        {/* All Day Toggle */}
        <div className="flex items-center justify-between">
          <Label>All-day event</Label>
          <Switch
            checked={editedEvent.allDay}
            onCheckedChange={(checked) => setEditedEvent({ ...editedEvent, allDay: checked })}
          />
        </div>

        {/* Recurrence */}
        <div className="space-y-2">
          <Label>Repeats</Label>
          <Select
            value={editedEvent.recurrenceRule}
            onValueChange={(value: RecurrenceRule) => setEditedEvent({ ...editedEvent, recurrenceRule: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recurrenceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reminder */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Reminder
          </Label>
          <Select
            value={editedEvent.reminders[0]?.minutesBefore?.toString() || '60'}
            onValueChange={(value) => setEditedEvent({ 
              ...editedEvent, 
              reminders: [{ minutesBefore: parseInt(value) }] 
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reminderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Linked Objects */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Link className="w-4 h-4" />
            Linked Job ID
          </Label>
          <Input
            value={editedEvent.linkedJobId || ''}
            onChange={(e) => setEditedEvent({ ...editedEvent, linkedJobId: e.target.value || undefined })}
            placeholder="Optional job ID"
          />
        </div>

        <div className="space-y-2">
          <Label>Linked Contact ID</Label>
          <Input
            value={editedEvent.linkedContactId || ''}
            onChange={(e) => setEditedEvent({ ...editedEvent, linkedContactId: e.target.value || undefined })}
            placeholder="Optional contact ID"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Notes
          </Label>
          <Textarea
            value={editedEvent.notes || ''}
            onChange={(e) => setEditedEvent({ ...editedEvent, notes: e.target.value })}
            placeholder="Add notes..."
            rows={3}
          />
        </div>

        {/* Suggested Message */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Suggested Message
          </Label>
          <Textarea
            value={editedEvent.suggestedMessageTemplate || ''}
            onChange={(e) => setEditedEvent({ ...editedEvent, suggestedMessageTemplate: e.target.value })}
            placeholder="Template message for follow-ups..."
            rows={4}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Smart buttons */}
        <div className="flex flex-wrap gap-2">
          {editedEvent.suggestedMessageTemplate && (
            <Button variant="outline" size="sm" onClick={handleCopyMessage}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied!' : 'Copy message'}
            </Button>
          )}
          {editedEvent.linkedJobId && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/job/${editedEvent.linkedJobId}`}>
                <ExternalLink className="w-4 h-4 mr-1" />
                Open Job
              </a>
            </Button>
          )}
          {editedEvent.status !== 'done' && !isNew && (
            <Button variant="outline" size="sm" onClick={handleMarkDone}>
              <Check className="w-4 h-4 mr-1" />
              Mark done
            </Button>
          )}
        </div>

        {/* Main actions */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4 mr-1" />
            {isNew ? 'Create' : 'Save'}
          </Button>
          {!isNew && (
            <Button variant="destructive" size="icon" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailsPanel;
