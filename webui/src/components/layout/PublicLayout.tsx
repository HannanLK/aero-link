import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Plane, MapPin, HelpCircle, Package, Menu, X, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../ui/button';

const NAV = [
  { label: 'Flights', to: '/' },
  { label: 'Track', to: '/track', icon: MapPin },
  { label: 'Baggage', to: '/help/baggage', icon: Package },
  { label: 'Help', to: '/help', icon: HelpCircle },
];

export function PublicLayout() {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/30 backdrop-blur-md bg-background/90 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight shrink-0">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Plane className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>AeroLink</span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 mx-8">
            {NAV.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }: { isActive: boolean }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-2">
            {token ? (
              <div className="flex items-center gap-2">
                <NavLink to="/bookings">
                  <Button variant="ghost" size="sm">My Bookings</Button>
                </NavLink>
                <NavLink to="/dashboard">
                  <Button size="sm" className="gap-1.5">
                    My Account <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </NavLink>
              </div>
            ) : (
              <>
                <NavLink to="/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </NavLink>
                <NavLink to="/register">
                  <Button size="sm">Register</Button>
                </NavLink>
              </>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden ml-2 size-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
            {NAV.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                {Icon && <Icon className="w-4 h-4" />}
                {label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-border mt-2 flex gap-2">
              {token ? (
                <Button className="flex-1" onClick={() => { navigate('/bookings'); setMobileOpen(false); }}>My Bookings</Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => { navigate('/login'); setMobileOpen(false); }}>Sign in</Button>
                  <Button className="flex-1" onClick={() => { navigate('/register'); setMobileOpen(false); }}>Register</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                  <Plane className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold">AeroLink</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Premium air travel connecting the world's most important destinations.
              </p>
            </div>
            {[
              { title: 'Fly', links: ['Book a flight', 'Flight tracker', 'Destinations', 'Schedules'] },
              { title: 'Travel', links: ['Baggage policy', 'Check-in', 'Manage booking', 'Seat selection'] },
              { title: 'Company', links: ['About AeroLink', 'Help centre', 'Privacy policy', 'Terms of use'] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="font-semibold text-sm mb-4">{title}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AeroLink. All rights reserved.</p>
            <div className="flex gap-4">
              {['Privacy', 'Cookies', 'Terms', 'Accessibility'].map((l) => (
                <a key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
