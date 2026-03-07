import { useState, useMemo } from "react";
import { Inbox as InboxIcon, Search, Filter, LayoutList, Layers, ChevronDown } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import InboxRow from "@/components/inbox/InboxRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { generateInboxActionsFromJobs, groupActionsByCategory } from "@/lib/inboxUtils";
import { InboxAction } from "@/types/inbox";
import { cn } from "@/lib/utils";
import { useJobs } from "@/hooks/useJobs";

const Inbox = () => {
  const { data: jobs = [] } = useJobs();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [priorityOpen, setPriorityOpen] = useState(true);
  const [waitingOpen, setWaitingOpen] = useState(true);
  const [setupOpen, setSetupOpen] = useState(true);

  const allActions = useMemo(() => {
    return generateInboxActionsFromJobs(jobs).map((action) => ({
      ...action,
      isSnoozed: snoozedIds.has(action.id),
      isCompleted: completedIds.has(action.id),
    }));
  }, [jobs, snoozedIds, completedIds]);

  const filteredActions = useMemo(() => {
    if (!searchQuery) return allActions;
    const query = searchQuery.toLowerCase();
    return allActions.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.companyName.toLowerCase().includes(query) ||
        a.roleTitle.toLowerCase().includes(query)
    );
  }, [allActions, searchQuery]);

  const grouped = useMemo(() => groupActionsByCategory(filteredActions), [filteredActions]);

  const handleMarkDone = (actionId: string) => {
    setCompletedIds((prev) => new Set([...prev, actionId]));
  };

  const handleSnooze = (actionId: string) => {
    setSnoozedIds((prev) => new Set([...prev, actionId]));
  };

  const snoozedActions = filteredActions.filter((a) => a.isSnoozed && !a.isCompleted);
  const completedActions = filteredActions.filter((a) => a.isCompleted);

  const renderSection = (
    title: string,
    actions: InboxAction[],
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    variant: "priority" | "waiting" | "setup"
  ) => {
    if (actions.length === 0) return null;

    const variantStyles = {
      priority: "border-l-primary",
      waiting: "border-l-orange-500",
      setup: "border-l-amber-500",
    };

    return (
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors border-l-4",
              variantStyles[variant]
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">{title}</span>
              <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                {actions.length}
              </span>
            </div>
            <ChevronDown
              className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {actions.map((action) => (
              <InboxRow key={action.id} action={action} onMarkDone={handleMarkDone} onSnooze={handleSnooze} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <Header />

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif font-bold text-foreground">Inbox</h2>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>

          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("grouped")}
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "flat" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("flat")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl p-6">
          {filteredActions.filter((a) => !a.isSnoozed && !a.isCompleted).length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <InboxIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">You're all caught up!</h3>
              <p className="text-sm text-muted-foreground">No pending actions at the moment.</p>
            </div>
          ) : viewMode === "grouped" ? (
            <div className="space-y-4">
              {renderSection("Priority Actions", grouped.priority, priorityOpen, setPriorityOpen, "priority")}
              {renderSection("Waiting / Nudges", grouped.waiting, waitingOpen, setWaitingOpen, "waiting")}
              {renderSection("Setup Gaps", grouped.setup, setupOpen, setSetupOpen, "setup")}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredActions
                .filter((a) => !a.isSnoozed && !a.isCompleted)
                .map((action) => (
                  <InboxRow key={action.id} action={action} onMarkDone={handleMarkDone} onSnooze={handleSnooze} />
                ))}
            </div>
          )}

          {/* Snoozed Section */}
          {snoozedActions.length > 0 && (
            <Collapsible className="mt-6">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-muted-foreground">Snoozed</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                      {snoozedActions.length}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1 opacity-60">
                  {snoozedActions.map((action) => (
                    <InboxRow key={action.id} action={action} onMarkDone={handleMarkDone} onSnooze={handleSnooze} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Completed Section */}
          {completedActions.length > 0 && (
            <Collapsible className="mt-4">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-muted-foreground">Completed</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                      {completedActions.length}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1 opacity-50">
                  {completedActions.map((action) => (
                    <InboxRow key={action.id} action={action} onMarkDone={handleMarkDone} onSnooze={handleSnooze} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </main>
    </div>
  );
};

export default Inbox;
