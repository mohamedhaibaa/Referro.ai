import { Presentation, Download, Sparkles } from "lucide-react";
import { useState } from "react";

const PitchDeckPanel = () => {
  const [generated, setGenerated] = useState(false);

  const slides = [
    "My Background",
    "Key Achievements",
    "Why This Role",
    "Value Proposition",
    "Questions for You",
  ];

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Pitch Deck</h2>
      
      <button 
        onClick={() => setGenerated(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors mb-4"
      >
        <Sparkles className="w-4 h-4" />
        Generate Pitch Deck
      </button>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">Status:</span>
        <span className={`text-sm font-medium ${generated ? 'text-green-600' : 'text-muted-foreground'}`}>
          {generated ? 'Generated' : 'Not generated'}
        </span>
      </div>

      {generated && (
        <>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors mb-4">
            <Download className="w-4 h-4" />
            Download PDF
          </button>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Slides</p>
            {slides.map((slide, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                <Presentation className="w-4 h-4 text-muted-foreground" />
                {i + 1}. {slide}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PitchDeckPanel;
