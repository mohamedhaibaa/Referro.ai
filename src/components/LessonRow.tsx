interface LessonRowProps {
  number: string;
  title: string;
  subtitle: string;
  teacher: string;
  teacherAvatar: string;
  duration: string;
}

const LessonRow = ({ number, title, subtitle, teacher, teacherAvatar, duration }: LessonRowProps) => {
  return (
    <div className="flex items-center py-4 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {number}. {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 w-48">
        <img
          src={teacherAvatar}
          alt={teacher}
          className="w-9 h-9 rounded-full object-cover"
        />
        <span className="text-sm text-foreground">{teacher}</span>
      </div>
      <div className="w-24 text-right">
        <span className="text-sm text-foreground">{duration}</span>
      </div>
    </div>
  );
};

export default LessonRow;
