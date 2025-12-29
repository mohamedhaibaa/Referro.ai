import { useState } from "react";
import { Calendar, Copy, Check, Send, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FollowUpScheduler = () => {
  const { toast } = useToast();
  const [followUpDate, setFollowUpDate] = useState("Jan 3, 2025");
  const [message, setMessage] = useState(
    "Hi [Name],\n\nJust wanted to follow up on my previous message. I'm still very interested in the opportunity and would love to connect whenever you have a moment.\n\nBest,\n[Your Name]"
  );
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast({ title: "Follow-up copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkSent = () => {
    setSent(true);
    toast({ title: "Follow-up marked as sent!" });
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Follow-up Scheduler</h2>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Recommended follow-up:</span>
          <input 
            type="text"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="px-2 py-1 bg-muted rounded border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
          <Clock className="w-4 h-4" />
          Follow-up due in 5 days
        </div>
      </div>
      
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        className="w-full p-4 bg-muted rounded-xl border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="flex items-center gap-3 mt-4">
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy follow-up'}
        </button>
        <button 
          onClick={handleMarkSent}
          disabled={sent}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sent 
              ? 'bg-green-100 text-green-700 cursor-default' 
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {sent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {sent ? 'Sent!' : 'Mark follow-up as Sent'}
        </button>
      </div>
    </div>
  );
};

export default FollowUpScheduler;
