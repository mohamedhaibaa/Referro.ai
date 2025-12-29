import LessonRow from "./LessonRow";

const lessons = [
  {
    number: "01",
    title: "Introduction to Creative Writing",
    subtitle: "Creative writing for beginners",
    teacher: "ConnerGarcia",
    teacherAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    duration: "22 min",
  },
  {
    number: "03",
    title: "Foundations of Public Speaking",
    subtitle: "Public Speaking and Leadership",
    teacher: "Saira Goodman",
    teacherAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    duration: "40 min",
  },
  {
    number: "05",
    title: "Getting to know the tool Adobe Illustrator",
    subtitle: "Digital Illustration with Adobe Illustrator",
    teacher: "Tony Ware",
    teacherAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    duration: "1h 08 min",
  },
  {
    number: "11",
    title: "Understanding audience psychology",
    subtitle: "Public Speaking: Basic course",
    teacher: "Mya Guzman",
    teacherAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    duration: "26 min",
  },
  {
    number: "04",
    title: "The importance of self reflection",
    subtitle: "Psychology of influence",
    teacher: "Zohaib Osborn",
    teacherAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    duration: "23 min",
  },
];

const MyLessons = () => {
  return (
    <div className="bg-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-serif font-semibold text-foreground">My next lessons</h2>
        <button className="text-primary text-sm font-medium hover:underline">
          View all lessons
        </button>
      </div>

      <div className="flex items-center py-3 text-xs text-muted-foreground uppercase tracking-wider">
        <div className="flex-1">Lesson</div>
        <div className="w-48">Teacher</div>
        <div className="w-24 text-right">Duration</div>
      </div>

      {lessons.map((lesson, index) => (
        <LessonRow key={index} {...lesson} />
      ))}
    </div>
  );
};

export default MyLessons;
