import { useMemo } from "react";
import {
  UserPlus,
  Send,
  MessageCircle,
  Coffee,
  CalendarCheck,
  Briefcase,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";
import { Contact, OutreachMessage } from "@/types/job";
import { OUTCOMES } from "@/lib/contactLifecycle";

interface ActivityTimelineProps {
  contact: Contact;
  messages: OutreachMessage[];
}

interface Entry {
  at: string;
  icon: typeof UserPlus;
  label: string;
  tone: "neutral" | "primary" | "landed" | "closed";
}

function relativeFrom(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs >= 1) return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
  const mins = Math.floor(diff / 60_000);
  if (mins >= 1) return mins === 1 ? "1 min ago" : `${mins} mins ago`;
  return "just now";
}

function outcomeVisual(outcome: string): { icon: typeof UserPlus; tone: Entry["tone"]; label: string } {
  if (outcome === OUTCOMES.OFFER) return { icon: CheckCircle2, tone: "landed", label: "Landed the offer 🎉" };
  if (outcome === OUTCOMES.REJECTED) return { icon: XCircle, tone: "closed", label: "Outcome: rejected" };
  if (outcome === OUTCOMES.WITHDREW) return { icon: Circle, tone: "closed", label: "Outcome: withdrew" };
  if (outcome === OUTCOMES.NOT_RIGHT_PERSON) return { icon: Circle, tone: "closed", label: "Outcome: not the right person" };
  if (outcome === OUTCOMES.NOT_A_FIT) return { icon: Circle, tone: "closed", label: "Outcome: not a fit" };
  if (outcome === OUTCOMES.LOST_TOUCH) return { icon: Circle, tone: "closed", label: "Outcome: lost touch" };
  if (outcome === OUTCOMES.CANCELLED) return { icon: Circle, tone: "closed", label: "Outcome: cancelled" };
  if (outcome === OUTCOMES.COMPANY_CANCELLED) return { icon: Circle, tone: "closed", label: "Outcome: company cancelled" };
  return { icon: Circle, tone: "closed", label: `Outcome: ${outcome}` };
}

const ActivityTimeline = ({ contact, messages }: ActivityTimelineProps) => {
  const entries = useMemo(() => {
    const out: Entry[] = [];

    if (contact.createdAt) {
      out.push({ at: contact.createdAt, icon: UserPlus, label: "Contact discovered", tone: "neutral" });
    }

    for (const m of messages) {
      if (!m.sentAt) continue;
      const label =
        m.type === "initial" ? "Sent initial message"
        : m.type === "followup_1" ? "Sent follow-up 1"
        : "Sent follow-up 2";
      out.push({ at: m.sentAt, icon: Send, label, tone: "primary" });
    }

    if (contact.repliedAt) {
      out.push({ at: contact.repliedAt, icon: MessageCircle, label: "They replied", tone: "primary" });
    }
    if (contact.coffeeChatScheduledAt) {
      out.push({ at: contact.coffeeChatScheduledAt, icon: Coffee, label: "Coffee chat scheduled", tone: "primary" });
    }
    if (contact.coffeeChatCompletedAt) {
      out.push({ at: contact.coffeeChatCompletedAt, icon: CalendarCheck, label: "Coffee chat completed", tone: "primary" });
    }
    if (contact.interviewScheduledAt) {
      out.push({ at: contact.interviewScheduledAt, icon: Briefcase, label: "Interview scheduled", tone: "primary" });
    }
    if (contact.interviewCompletedAt) {
      out.push({ at: contact.interviewCompletedAt, icon: CalendarCheck, label: "Interview completed", tone: "primary" });
    }
    if (contact.outcome && contact.outcomeRecordedAt) {
      const v = outcomeVisual(contact.outcome);
      out.push({ at: contact.outcomeRecordedAt, icon: v.icon, label: v.label, tone: v.tone });
    }

    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return out;
  }, [contact, messages]);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</h3>
      <ul className="space-y-2">
        {entries.map((e, i) => {
          const Icon = e.icon;
          const iconClass =
            e.tone === "landed" ? "text-[hsl(var(--progress-yellow))]"
            : e.tone === "primary" ? "text-primary"
            : e.tone === "closed" ? "text-muted-foreground"
            : "text-muted-foreground";
          return (
            <li key={i} className="flex items-center gap-3 text-sm">
              <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
              <span className="text-foreground flex-1">{e.label}</span>
              <span
                className="text-xs text-muted-foreground whitespace-nowrap"
                title={new Date(e.at).toLocaleString()}
              >
                {relativeFrom(e.at)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ActivityTimeline;
