import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Plane, Package, ClipboardCheck, LayoutDashboard, LogOut, ShieldCheck, BookOpen, Globe } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../lib/api';

export function Layout() {
  const { user, hasRole, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    navigate('/login');
  };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-primary/15 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/90 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <Plane className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>AeroLink</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/bookings" className={navCls}>
              <BookOpen className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              My Bookings
            </NavLink>
            <NavLink to="/checkin" className={navCls}>
              Check-in
            </NavLink>
            <NavLink to="/baggage" className={navCls}>
              <Package className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Baggage
            </NavLink>

            {(hasRole('FLIGHT_OPS') || hasRole('ADMIN')) && (
              <NavLink
                to="/flight-ops"
                className={({ isActive }: { isActive: boolean }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-blue-500/15 text-blue-300 font-medium' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'}`
                }
              >
                <LayoutDashboard className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Flight Ops
              </NavLink>
            )}

            {(hasRole('GATE_AGENT') || hasRole('ADMIN')) && (
              <NavLink
                to="/gate-agent"
                className={({ isActive }: { isActive: boolean }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-amber-500/15 text-amber-300 font-medium' : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'}`
                }
              >
                <ClipboardCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Gate Agent
              </NavLink>
            )}

            {(hasRole('IMMIGRATION_OFFICER') || hasRole('ADMIN')) && (
              <NavLink
                to="/immigration"
                className={({ isActive }: { isActive: boolean }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-green-500/20 text-green-300 font-medium' : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'}`
                }
              >
                <Globe className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Immigration
              </NavLink>
            )}

            {hasRole('ADMIN') && (
              <NavLink
                to="/admin"
                className={({ isActive }: { isActive: boolean }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-primary/20 text-primary font-medium' : 'text-primary hover:bg-primary/10'}`
                }
              >
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                {user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors px-2 py-1.5 rounded-md hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
