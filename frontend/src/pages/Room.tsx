import { useParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

const Room = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8">
        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-2xl text-muted-foreground">
            Room for job {id} — coming soon
          </p>
        </div>
      </main>
    </div>
  );
};

export default Room;
