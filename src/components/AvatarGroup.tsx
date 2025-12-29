interface AvatarGroupProps {
  avatars: string[];
  count: number;
}

const AvatarGroup = ({ avatars, count }: AvatarGroupProps) => {
  return (
    <div className="flex items-center">
      {avatars.slice(0, 3).map((avatar, index) => (
        <img
          key={index}
          src={avatar}
          alt="Student"
          className="w-9 h-9 rounded-full border-2 border-card object-cover -ml-2 first:ml-0"
        />
      ))}
      <div className="w-9 h-9 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center -ml-2">
        +{count}
      </div>
    </div>
  );
};

export default AvatarGroup;
