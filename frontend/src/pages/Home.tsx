import Sidebar from "@/components/Sidebar";

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8">
        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-2xl text-muted-foreground">Home — coming soon</p>
        </div>
      </main>
    </div>
  );
};

export default Home;
