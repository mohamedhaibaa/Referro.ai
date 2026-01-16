import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { JobStatus, PIPELINE_STAGES } from "@/types/job";

export interface FilterState {
  company: string;
  tags: string[];
  status: JobStatus[];
}

interface KanbanFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTags: string[];
}


const KanbanFilters = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableTags,
}: KanbanFiltersProps) => {
  const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    return arr.includes(item)
      ? arr.filter((i) => i !== item)
      : [...arr, item];
  };

  const handleClearAll = () => {
    onFiltersChange({
      company: "",
      tags: [],
      status: [],
    });
  };

  const hasActiveFilters =
    filters.company.length > 0 ||
    filters.tags.length > 0 ||
    filters.status.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Filter Jobs</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-4 mt-6">
          <div className="space-y-6">
            {/* Company */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Company</Label>
              <Input
                placeholder="Search company..."
                value={filters.company}
                onChange={(e) =>
                  onFiltersChange({ ...filters, company: e.target.value })
                }
              />
            </div>

            <Separator />

            {/* Tags */}
            {availableTags.length > 0 && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Tags</Label>
                  <div className="space-y-2">
                    {availableTags.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={filters.tags.includes(tag)}
                          onCheckedChange={() =>
                            onFiltersChange({
                              ...filters,
                              tags: toggleArrayItem(filters.tags, tag),
                            })
                          }
                        />
                        <label
                          htmlFor={`tag-${tag}`}
                          className="text-sm text-foreground cursor-pointer"
                        >
                          {tag}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Status */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Status</Label>
              <div className="space-y-2">
                {PIPELINE_STAGES.map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={filters.status.includes(status)}
                      onCheckedChange={() =>
                        onFiltersChange({
                          ...filters,
                          status: toggleArrayItem(filters.status, status),
                        })
                      }
                    />
                    <label
                      htmlFor={`status-${status}`}
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {status}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClearAll}
              disabled={!hasActiveFilters}
            >
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Apply
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default KanbanFilters;
