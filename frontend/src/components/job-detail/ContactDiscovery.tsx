import { User, ExternalLink, Check } from "lucide-react";
import { Contact } from "@/types/job";
import { useState } from "react";

interface ContactDiscoveryProps {
  contacts: Contact[];
}

const confidenceColors = {
  High: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-red-100 text-red-700",
};

const ContactDiscovery = ({ contacts }: ContactDiscoveryProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Who to Reach Out To</h2>
      
      {contacts.length > 0 ? (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div 
              key={contact.id}
              className={`p-4 rounded-xl border transition-all ${
                selectedId === contact.id 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
                        {contact.relationship}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${confidenceColors[contact.confidence]}`}>
                        {contact.confidence} confidence
                      </span>
                      <span className="text-xs text-muted-foreground">
                        via {contact.source}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button 
                    onClick={() => setSelectedId(selectedId === contact.id ? null : contact.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedId === contact.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {selectedId === contact.id ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    ) : 'Select'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center bg-muted/50 rounded-xl">
          <p className="text-muted-foreground mb-3">No confident contacts found</p>
          <button className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            Proceed without contact
          </button>
        </div>
      )}
    </div>
  );
};

export default ContactDiscovery;
