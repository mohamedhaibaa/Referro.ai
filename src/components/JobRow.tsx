import { useNavigate } from "react-router-dom";
import { Building2, Calendar } from "lucide-react";
import { JobStatus } from "@/types/job";

interface JobRowProps {
  id: string;
  title: string;
  company: string;
  dueDate: string;
  status: JobStatus;
}

const statusColors: Record<JobStatus, string> = {
  "Interested": "bg-blue-100 text-blue-700",
  "Outreach Ready": "bg-yellow-100 text-yellow-700",
  "Outreach Sent": "bg-orange-100 text-orange-700",
  "Replied": "bg-green-100 text-green-700",
  "Meeting Booked": "bg-purple-100 text-purple-700",
  "Interviewing": "bg-indigo-100 text-indigo-700",
  "Offer": "bg-emerald-100 text-emerald-700",
  "Closed": "bg-gray-100 text-gray-700",
};

const JobRow = ({ id, title, company, dueDate, status }: JobRowProps) => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/job/${id}`)}
      className="flex items-center py-4 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg px-2 -mx-2"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
      </div>
      <div className="flex items-center gap-2 w-40">
        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground truncate">{company}</span>
      </div>
      <div className="flex items-center gap-2 w-32">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground">{dueDate}</span>
      </div>
      <div className="w-32 text-right">
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      </div>
    </div>
  );
};

export default JobRow;
