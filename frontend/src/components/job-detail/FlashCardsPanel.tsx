import { Sparkles, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import { useState } from "react";

interface FlashCard {
  id: string;
  title: string;
  strength: string;
  evidence: string;
  impact: string;
}

const defaultCards: FlashCard[] = [
  {
    id: "1",
    title: "Tell me about yourself",
    strength: "Clear career narrative",
    evidence: "5 years progressive experience",
    impact: "Demonstrates growth mindset",
  },
  {
    id: "2",
    title: "Why this company?",
    strength: "Company research",
    evidence: "Specific product knowledge",
    impact: "Shows genuine interest",
  },
  {
    id: "3",
    title: "Project deep dive",
    strength: "Technical depth",
    evidence: "Led team of 5, shipped on time",
    impact: "Quantifiable results",
  },
];

const FlashCardsPanel = () => {
  const [generated, setGenerated] = useState(false);
  const [cards, setCards] = useState<FlashCard[]>(defaultCards);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Flash Cards</h2>
      
      <button 
        onClick={() => setGenerated(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors mb-4"
      >
        <Sparkles className="w-4 h-4" />
        Generate Flash Cards
      </button>

      {generated && (
        <div className="space-y-2">
          {cards.map((card) => (
            <div key={card.id} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === card.id ? null : card.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{card.title}</span>
                {expandedId === card.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              
              {expandedId === card.id && (
                <div className="p-3 pt-0 border-t border-border bg-muted/30">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Strength: </span>
                      <span className="text-foreground">{card.strength}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Evidence: </span>
                      <span className="text-foreground">{card.evidence}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impact: </span>
                      <span className="text-foreground">{card.impact}</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-primary text-xs mt-3 hover:underline">
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlashCardsPanel;
