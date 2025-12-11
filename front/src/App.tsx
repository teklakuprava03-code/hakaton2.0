import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CouncilRealtimeToast } from "@/components/CouncilRealtimeToast";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientChat from "./pages/PatientChat";
import PersonalChat from "./pages/PersonalChat";
import AIAssistant from "./pages/AIAssistant";
import Council from "./pages/Council";
import Chats from "./pages/Chats";
import CalendarPage from "./pages/CalendarPage";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import SeedData from "./pages/SeedData";
import NotFound from "./pages/NotFound";
import PatientsPage from "./pages/Patients";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CouncilRealtimeToast />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/seed-data" element={<SeedData />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/patients/:patientId/chat" element={<ProtectedRoute><PatientChat /></ProtectedRoute>} />
          <Route path="/patients/:patientId/council" element={<ProtectedRoute><Council /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><Chats /></ProtectedRoute>} />
          <Route path="/chats/:chatId" element={<ProtectedRoute><PersonalChat /></ProtectedRoute>} />
          <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/test-patients" element={<PatientsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
