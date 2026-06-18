import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Demo from "./pages/Demo.tsx";
import Pricing from "./pages/Pricing.tsx";
import Setup from "./pages/Setup.tsx";
import Settings from "./pages/Settings.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Support from "./pages/Support.tsx";
import Start from "./pages/Start.tsx";
import Signup from "./pages/Signup.tsx";
import Confirm from "./pages/Confirm.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import LeadInbox from "./pages/LeadInbox.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RequireAuth, RedirectIfAuthed } from "./components/route-guards";

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
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/leads" element={<RequireAuth><LeadInbox /></RequireAuth>} />
          <Route path="/support" element={<Support />} />
          <Route path="/auth" element={<RedirectIfAuthed><Auth /></RedirectIfAuthed>} />
          <Route path="/login" element={<RedirectIfAuthed><Auth /></RedirectIfAuthed>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
