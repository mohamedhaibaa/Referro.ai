import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Linkedin } from "lucide-react";
import { Contact, Job } from "@/types/job";

interface CelebrationViewProps {
  job: Job;
  contact: Contact;
  onClose: () => void;
}

const CELEBRATED_KEY_PREFIX = "referroing:celebrated:";
const CONFETTI_COLORS = ["#E8A838", "#E8734A", "#FBF8F3", "#F5D78B"];

function buildShareUrl(job: Job, contact: Contact): string {
  const firstName = (contact.fullName || "them").split(" ")[0];
  const jobTitle = job.title || "my new role";
  const company = job.company || "the company";
  const text = `Just landed my role as ${jobTitle} at ${company} 🎉\n\nInstead of applying cold, I reached out to ${firstName} directly — and here we are. Built my pipeline with Referro.\n\nLand jobs through people, not portals.`;
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://getreferro.ai")}&summary=${encodeURIComponent(text)}`;
}

const CelebrationView = ({ job, contact, onClose }: CelebrationViewProps) => {
  const fired = useRef(false);
  const firstName = (contact.fullName || "them").split(" ")[0];

  useEffect(() => {
    if (fired.current) return;
    const key = `${CELEBRATED_KEY_PREFIX}${contact.id}`;
    if (localStorage.getItem(key)) {
      fired.current = true;
      return;
    }

    fired.current = true;
    localStorage.setItem(key, "1");

    const end = Date.now() + 1500;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.9 },
        colors: CONFETTI_COLORS,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.9 },
        colors: CONFETTI_COLORS,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [contact.id]);

  const handleShare = () => {
    window.open(buildShareUrl(job, contact), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative flex flex-col items-center justify-center py-12 px-6 rounded-2xl bg-gradient-to-br from-[#FBF8F3] via-[#F5D78B]/40 to-[#E8A838]/20 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-4xl font-serif font-normal text-foreground mb-3">
        You landed it!
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Thanks to {firstName} — they helped you get there.
      </p>
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Close
        </button>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
        >
          <Linkedin className="w-3.5 h-3.5" />
          Share on LinkedIn
        </button>
      </div>
    </div>
  );
};

export default CelebrationView;
