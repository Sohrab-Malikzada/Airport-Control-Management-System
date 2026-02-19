import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Flights from "@/pages/Flights";
import Runways from "@/pages/Runways";
import ATCPanel from "@/pages/ATCPanel";
import Passengers from "@/pages/Passengers";
import Alerts from "@/pages/Alerts";
import ActivityLog from "@/pages/ActivityLog";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/flights" element={<ProtectedRoute><Flights /></ProtectedRoute>} />
            <Route path="/runways" element={<ProtectedRoute><Runways /></ProtectedRoute>} />
            <Route path="/atc" element={<ProtectedRoute><ATCPanel /></ProtectedRoute>} />
            <Route path="/passengers" element={<ProtectedRoute><Passengers /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute><ActivityLog /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireRole="admin"><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
