import { Compass, Archive, Search } from "lucide-react";

export const PathForwardIllustration = () => (
  <div className="w-20 h-20 rounded-full bg-muted/40 ring-1 ring-border/50 flex items-center justify-center">
    <Compass className="w-10 h-10 text-[#E8A838]/80" strokeWidth={1.5} />
  </div>
);

export const EmptyBoxIllustration = () => (
  <div className="w-20 h-20 rounded-full bg-muted/40 ring-1 ring-border/50 flex items-center justify-center">
    <Archive className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
  </div>
);

export const RadarSweepIllustration = () => (
  <div className="w-20 h-20 rounded-full bg-muted/40 ring-1 ring-border/50 flex items-center justify-center">
    <Search className="w-10 h-10 text-[#E8734A]/80" strokeWidth={1.5} />
  </div>
);
