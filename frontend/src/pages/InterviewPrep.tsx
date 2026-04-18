import { ArrowLeft, Briefcase } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useJob } from "@/hooks/useJobs";

const InterviewPrep = () => {
  const { id, contactId } = useParams<{ id: string; contactId: string }>();
  const { data: job } = useJob(id ?? "");

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8 max-w-4xl">
        <Link
          to={`/jobs/${id}/room`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Room
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium mb-3">
            <Briefcase className="w-3.5 h-3.5" />
            Interview prep
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {job?.title || "Untitled"}
          </h1>
          <p className="text-muted-foreground mt-1">{job?.company || "—"}</p>
        </div>

        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
          <p className="text-base text-foreground">AI-generated prep coming soon</p>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            We'll build a tailored interview prep pack: company research recap, role
            requirements, mock questions, and STAR-ready stories pulled from your resume
            — so you walk in ready.
          </p>
          <p className="text-xs text-muted-foreground/70">Contact ID: {contactId}</p>
        </div>
      </main>
    </div>
  );
};

export default InterviewPrep;
