import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ReferroingProvider } from "./contexts/ReferroingContext";
import ReferroingOverlay from "./components/referroing/ReferroingOverlay";
import ReferroingPill from "./components/referroing/ReferroingPill";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Inbox from "./pages/Inbox";
import JobDetail from "./pages/JobDetail";
import Room from "./pages/Room";
import CoffeeChatPrep from "./pages/CoffeeChatPrep";
import InterviewPrep from "./pages/InterviewPrep";
import PitchDeck from "./pages/PitchDeck";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OnboardingResume from "./pages/OnboardingResume";
import Resume from "./pages/Resume";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ReferroingProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
              <Route path="/job/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
              <Route path="/jobs/:id/room" element={<ProtectedRoute><Room /></ProtectedRoute>} />
              <Route path="/jobs/:id/contacts/:contactId/coffee-chat-prep" element={<ProtectedRoute><CoffeeChatPrep /></ProtectedRoute>} />
              <Route path="/jobs/:id/contacts/:contactId/interview-prep" element={<ProtectedRoute><InterviewPrep /></ProtectedRoute>} />
              <Route path="/jobs/:id/contacts/:contactId/pitch-deck" element={<ProtectedRoute><PitchDeck /></ProtectedRoute>} />
              <Route path="/onboarding/resume" element={<ProtectedRoute><OnboardingResume /></ProtectedRoute>} />
              <Route path="/resume" element={<ProtectedRoute><Resume /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ReferroingOverlay />
            <ReferroingPill />
          </ReferroingProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
