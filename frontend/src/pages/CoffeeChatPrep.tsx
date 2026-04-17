import { useParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

const CoffeeChatPrep = () => {
  const { id, contactId } = useParams<{ id: string; contactId: string }>();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8">
        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-2xl text-muted-foreground">
            Coffee chat prep — job {id}, contact {contactId} — coming soon
          </p>
        </div>
      </main>
    </div>
  );
};

export default CoffeeChatPrep;
