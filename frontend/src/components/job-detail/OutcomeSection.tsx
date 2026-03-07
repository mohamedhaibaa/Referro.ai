import { useState } from "react";
import { Trophy, XCircle, ArrowRight, Copy } from "lucide-react";

type Outcome = "Offer" | "Rejected" | "Withdrew" | "No response" | null;

const OutcomeSection = () => {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [reflection, setReflection] = useState("");

  const outcomes: { value: Outcome; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "Offer", label: "Offer", icon: <Trophy className="w-4 h-4" />, color: "bg-green-100 text-green-700 border-green-300" },
    { value: "Rejected", label: "Rejected", icon: <XCircle className="w-4 h-4" />, color: "bg-red-100 text-red-700 border-red-300" },
    { value: "Withdrew", label: "Withdrew", icon: <ArrowRight className="w-4 h-4" />, color: "bg-gray-100 text-gray-700 border-gray-300" },
    { value: "No response", label: "No response", icon: null, color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  ];

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Outcome</h2>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {outcomes.map(o => (
          <button
            key={o.value}
            onClick={() => setOutcome(o.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              outcome === o.value 
                ? o.color 
                : 'bg-muted border-border text-foreground hover:bg-muted/80'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      {outcome && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">What worked? (optional reflection)</label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              placeholder="What did I learn from this application?"
              className="w-full p-3 bg-muted rounded-xl border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            <Copy className="w-4 h-4" />
            Clone this job setup for another role
          </button>
        </div>
      )}
    </div>
  );
};

export default OutcomeSection;
