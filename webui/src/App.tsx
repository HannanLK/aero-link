import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import { PublicLayout } from './components/layout/PublicLayout';
import { Layout } from './components/layout/Layout';

// Public pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { FlightTrackerPage } from './pages/FlightTrackerPage';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { BaggagePolicyPage } from './pages/BaggagePolicyPage';

// Auth-required pages
import { BookingPage } from './pages/BookingPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { CheckInPage } from './pages/CheckInPage';
import { BaggageTrackerPage } from './pages/BaggageTrackerPage';
import { AdminDashboard } from './pages/AdminDashboard';

// Staff pages
import { FlightOpsPage } from './pages/FlightOpsPage';
import { GateAgentPage } from './pages/GateAgentPage';
import { ImmigrationOfficerPage } from './pages/ImmigrationOfficerPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const hasRole = useAuthStore((s) => s.hasRole);
  return hasRole(role as any) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* ── Public routes (no auth needed) ── */}
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="search" element={<SearchResultsPage />} />
            <Route path="track" element={<FlightTrackerPage />} />
            <Route path="help" element={<HelpCenterPage />} />
            <Route path="help/baggage" element={<BaggagePolicyPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* ── Authenticated routes ── */}
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="dashboard" element={<Navigate to="/" replace />} />

            {/* Passenger flows */}
            <Route path="flights/:flightId/book" element={<BookingPage />} />
            <Route path="bookings" element={<MyBookingsPage />} />
            <Route path="checkin" element={<CheckInPage />} />
            <Route path="baggage" element={<BaggageTrackerPage />} />

            {/* Staff — flight ops */}
            <Route path="flight-ops" element={
              <RequireRole role="FLIGHT_OPS"><FlightOpsPage /></RequireRole>
            } />

            {/* Staff — gate agent */}
            <Route path="gate-agent" element={
              <RequireRole role="GATE_AGENT"><GateAgentPage /></RequireRole>
            } />

            {/* Staff — immigration */}
            <Route path="immigration" element={
              <RequireRole role="IMMIGRATION_OFFICER"><ImmigrationOfficerPage /></RequireRole>
            } />

            {/* Admin */}
            <Route path="admin" element={
              <RequireRole role="ADMIN"><AdminDashboard /></RequireRole>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
