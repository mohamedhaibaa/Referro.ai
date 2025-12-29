import AvatarGroup from "./AvatarGroup";

const avatars = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
];

const RecommendedCourse = () => {
  return (
    <div className="card-dark rounded-2xl p-6 text-background flex flex-col h-full">
      <p className="text-sm text-background/70 mb-4">New course matching your interests</p>

      <span className="inline-flex w-fit px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-foreground mb-4">
        Computer Science
      </span>

      <h3 className="text-xl font-semibold leading-tight mb-6">
        Microsoft Future Ready: Fundamentals of Big Data
      </h3>

      <p className="text-sm text-background/70 mb-3">They are already studying</p>

      <AvatarGroup avatars={avatars} count={100} />

      <button className="mt-auto w-full py-3.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
        More details
      </button>
    </div>
  );
};

export default RecommendedCourse;
