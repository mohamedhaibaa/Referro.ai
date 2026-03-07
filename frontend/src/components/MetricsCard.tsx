import { Coffee, Calendar } from "lucide-react";

interface MetricsCardProps {
  coffeeChats: number;
  interviews: number;
}

const MetricsCard = ({ coffeeChats, interviews }: MetricsCardProps) => {
  return (
    <div className="card-lavender rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card/80 text-foreground">
          Networking
        </span>
      </div>

      <h3 className="text-lg font-semibold text-foreground leading-tight mb-6">
        Connections Made
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-foreground/70" />
            </div>
            <span className="text-sm text-foreground/70">Coffee Chats</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{coffeeChats}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-foreground/70" />
            </div>
            <span className="text-sm text-foreground/70">Interviews</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{interviews}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsCard;
