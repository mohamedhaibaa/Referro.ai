import { Check } from "lucide-react";

interface ProgressTrackerProps {
  progress: number;
  milestones: {
    resumeTailored: boolean;
    contactSelected: boolean;
    outreachSent: boolean;
    followUpSent: boolean;
    replyReceived: boolean;
    interviewScheduled: boolean;
    interviewPrep1: boolean;
    interviewPrep2: boolean;
    interviewPrep3: boolean;
    outcomeRecorded: boolean;
  };
  onToggle: (key: keyof ProgressTrackerProps['milestones']) => void;
}

const milestoneLabels: Record<keyof ProgressTrackerProps['milestones'], string> = {
  resumeTailored: "Resume tailored",
  contactSelected: "Contact selected",
  outreachSent: "Outreach sent",
  followUpSent: "Follow-up sent",
  replyReceived: "Reply received",
  interviewScheduled: "Interview scheduled",
  interviewPrep1: "Interview prep Day 1",
  interviewPrep2: "Interview prep Day 2",
  interviewPrep3: "Interview prep Day 3",
  outcomeRecorded: "Outcome recorded",
};

const ProgressTracker = ({ progress, milestones, onToggle }: ProgressTrackerProps) => {
  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Progress Tracker</h2>
      
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Overall Progress</span>
          <span className="text-sm font-semibold text-foreground">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestones Grid */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(milestones) as Array<keyof typeof milestones>).map((key) => (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              milestones[key] 
                ? 'bg-primary/10 border-primary text-foreground' 
                : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              milestones[key] ? 'bg-primary' : 'bg-border'
            }`}>
              {milestones[key] && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            <span className="text-sm">{milestoneLabels[key]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProgressTracker;
