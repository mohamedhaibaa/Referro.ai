import { useState } from "react";

const filters = ["All courses", "Marketing", "Computer Science", "Psychology"];

const CourseFilters = () => {
  const [active, setActive] = useState("All courses");

  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => setActive(filter)}
          className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            active === filter
              ? "bg-foreground text-background"
              : "bg-card border border-border text-foreground hover:bg-muted"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
};

export default CourseFilters;
