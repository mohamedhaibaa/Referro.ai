import { Calendar, Check, Bell } from "lucide-react";
import { useState } from "react";

const InterviewMode = () => {
  const [interviewDate, setInterviewDate] = useState("");
  const [reminders, setReminders] = useState(true);
  const [days, setDays] = useState({
    day1: false,
    day2: false,
    day3: false,
  });

  const dayPlan = {
    day1: {
      title: "Day 1: Story & Projects",
      tasks: ["Prepare STAR stories", "Review key projects", "Practice elevator pitch"],
    },
    day2: {
      title: "Day 2: Role-Specific Questions",
      tasks: ["Research company news", "Prepare role questions", "Review job requirements"],
    },
    day3: {
      title: "Day 3: Mock & Weak Spots",
      tasks: ["Do mock interview", "Work on weak areas", "Prepare questions to ask"],
    },
  };

  return (
    <div className="bg-card rounded-2xl p-6 border-2 border-primary">
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
          INTERVIEW MODE
        </span>
      </div>
      
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">3-Day Interview Prep</h2>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input 
            type="text"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            placeholder="Interview date/time"
            className="px-3 py-1.5 bg-muted rounded border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <button 
          onClick={() => setReminders(!reminders)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
            reminders 
              ? 'bg-primary/10 text-primary' 
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <Bell className="w-4 h-4" />
          Daily reminders {reminders ? 'on' : 'off'}
        </button>
      </div>

      <div className="space-y-4">
        {(Object.entries(dayPlan) as [keyof typeof days, typeof dayPlan.day1][]).map(([key, day]) => (
          <div key={key} className={`p-4 rounded-xl border ${days[key] ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-foreground">{day.title}</h3>
              <button
                onClick={() => setDays(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  days[key] 
                    ? 'bg-green-500 text-white' 
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {days[key] ? (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" /> Completed
                  </span>
                ) : 'Mark complete'}
              </button>
            </div>
            <ul className="space-y-1">
              {day.tasks.map((task, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  {task}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterviewMode;
