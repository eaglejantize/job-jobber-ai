import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Demo from "./pages/Demo.tsx";
import Pricing from "./pages/Pricing.tsx";
import Setup from "./pages/Setup.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Settings from "./pages/Settings.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Home from "./pages/Home.tsx";
import Support from "./pages/Support.tsx";
import Trust from "./pages/Trust.tsx";
import Start from "./pages/Start.tsx";
import Signup from "./pages/Signup.tsx";
import Confirm from "./pages/Confirm.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import LeadInbox from "./pages/LeadInbox.tsx";
import Admin from "./pages/Admin.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RequireAuth, RedirectIfAuthed } from "./components/route-guards";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import OnboardingGate from "./components/OnboardingGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RedirectIfAuthed><Index /></RedirectIfAuthed>} />
          <Route path="/demo" element={<RedirectIfAuthed><Demo /></RedirectIfAuthed>} />
          <Route path="/pricing" element={<RedirectIfAuthed><Pricing /></RedirectIfAuthed>} />
          <Route path="/start" element={<Start />} />
          <Route path="/signup" element={<RedirectIfAuthed><Signup /></RedirectIfAuthed>} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/setup" element={<RequireAuth><Setup /></RequireAuth>} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><OnboardingGate><Settings /></OnboardingGate></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><OnboardingGate><Dashboard /></OnboardingGate></RequireAuth>} />
          <Route path="/home" element={<RequireAuth><OnboardingGate><Home /></OnboardingGate></RequireAuth>} />
          <Route path="/leads" element={<RequireAuth><OnboardingGate><LeadInbox /></OnboardingGate></RequireAuth>} />
          <Route path="/admin" element={<ProtectedAdminRoute><Admin /></ProtectedAdminRoute>} />
          <Route path="/support" element={<Support />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/auth" element={<RedirectIfAuthed><Auth /></RedirectIfAuthed>} />
          <Route path="/login" element={<RedirectIfAuthed><Auth /></RedirectIfAuthed>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
