import { useState } from "react";
import { Copy, Check, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OutreachBuilder = () => {
  const { toast } = useToast();
  const [message, setMessage] = useState(
    "Hi [Name],\n\nI came across your profile and noticed you're at [Company]. I'm really interested in the [Role] position and would love to learn more about the team and culture.\n\nWould you be open to a quick 15-minute chat?\n\nBest,\n[Your Name]"
  );
  const [copied, setCopied] = useState(false);
  const [messageHistory, setMessageHistory] = useState<Array<{type: string, date: string}>>([]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast({ title: "Message copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkSent = () => {
    const now = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    setMessageHistory(prev => [...prev, { type: "Message sent", date: now }]);
    toast({ title: "Marked as sent!" });
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Outreach Message Builder</h2>
      
      <p className="text-sm text-muted-foreground mb-3">Message prepared for: <span className="text-foreground">Selected Contact</span></p>
      
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={8}
        className="w-full p-4 bg-muted rounded-xl border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="flex items-center gap-3 mt-4">
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy message'}
        </button>
        <button 
          onClick={handleMarkSent}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
          Mark as Sent
        </button>
      </div>

      {messageHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Message History</p>
          <div className="space-y-1">
            {messageHistory.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.type}</span>
                <span className="text-muted-foreground">{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutreachBuilder;
