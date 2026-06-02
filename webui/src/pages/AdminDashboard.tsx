import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Users, BookOpen, CreditCard, Plane,
  Server, CheckCircle, XCircle, RefreshCw, ShieldCheck,
  TrendingUp, Clock, AlertTriangle,
} from 'lucide-react';
import { bookingsApi, flightsApi, authApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { formatPrice } from '../lib/pricing';

// ─── Service Health ──────────────────────────────────────────────────────────

const SERVICES = [
  { name: 'Identity', path: '/auth/health/live', port: 3001 },
  { name: 'Flights', path: '/flights/health/live', port: 3002 },
  { name: 'Booking', path: '/bookings/health/live', port: 3003 },
  { name: 'Payment', path: '/payments/health/live', port: 3004 },
  { name: 'Check-in', path: '/checkin/health/live', port: 3005 },
  { name: 'Baggage', path: '/baggage/health/live', port: 3006 },
  { name: 'Notification', path: '/api/v1/health/live', port: 3007 },
];

type ServiceStatus = 'up' | 'down' | 'checking';

function useServiceHealth() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(
    Object.fromEntries(SERVICES.map((s) => [s.name, 'checking']))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function check() {
    setStatuses(Object.fromEntries(SERVICES.map((s) => [s.name, 'checking'])));
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        try {
          // Via NGINX api-gateway
          const url = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'}${svc.path}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
          return { name: svc.name, status: res.ok ? 'up' : 'down' } as const;
        } catch {
          return { name: svc.name, status: 'down' } as const;
        }
      })
    );
    setStatuses(Object.fromEntries(results.map((r) => [r.name, r.status])));
    setLastChecked(new Date());
  }

  useEffect(() => { check(); }, []);

  return { statuses, lastChecked, refresh: check };
}

// ─── Booking Status Colours ──────────────────────────────────────────────────

const BOOKING_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  CONFIRMED: 'bg-green-500/15 text-green-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
  PAYMENT_FAILED: 'bg-red-500/15 text-red-400',
  SEAT_LOCKED: 'bg-blue-500/15 text-blue-400',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { statuses, lastChecked, refresh } = useServiceHealth();
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'users' | 'bookings'>('overview');

  const upCount = Object.values(statuses).filter((s) => s === 'up').length;
  const downCount = Object.values(statuses).filter((s) => s === 'down').length;

  // Bookings data
  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => bookingsApi.list(),
    select: (r) => r.data.data as any[],
    staleTime: 60_000,
  });

  // Flights data
  const { data: flights } = useQuery({
    queryKey: ['admin-flights'],
    queryFn: () => flightsApi.search('SIN', 'KUL', new Date().toISOString().split('T')[0]),
    select: (r) => r.data.data as any[],
    staleTime: 60_000,
  });

  // Users data
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.getUsers?.() ?? Promise.resolve({ data: { data: [] } }),
    select: (r) => r.data.data as any[],
    staleTime: 60_000,
    retry: 1,
  });

  const confirmedBookings = bookings?.filter((b: any) => b.status === 'CONFIRMED') ?? [];
  const revenue = confirmedBookings.reduce((sum: number, b: any) => sum + (b.totalAmount ?? 0), 0);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'bookings', label: 'Bookings', icon: BookOpen },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm">System health, user management, and platform metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {downCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium bg-red-500/15 text-red-400 px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              {downCount} service{downCount > 1 ? 's' : ''} down
            </span>
          )}
          {downCount === 0 && upCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium bg-green-500/15 text-green-400 px-3 py-1.5 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" />
              All systems operational
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Total Bookings',
                value: bookings?.length ?? '—',
                sub: `${confirmedBookings.length} confirmed`,
                icon: BookOpen,
                color: 'text-primary',
              },
              {
                title: 'Revenue',
                value: revenue > 0 ? formatPrice(revenue) : '—',
                sub: 'All confirmed bookings',
                icon: CreditCard,
                color: 'text-green-400',
              },
              {
                title: 'Active Flights',
                value: flights?.filter((f: any) => ['SCHEDULED', 'BOARDING', 'IN_AIR'].includes(f.status)).length ?? '—',
                sub: 'Today',
                icon: Plane,
                color: 'text-blue-400',
              },
              {
                title: 'Services',
                value: `${upCount}/${SERVICES.length}`,
                sub: downCount > 0 ? `${downCount} degraded` : 'All healthy',
                icon: Activity,
                color: downCount > 0 ? 'text-red-400' : 'text-green-400',
              },
            ].map(({ title, value, sub, icon: Icon, color }) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <CardDescription>{title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </div>
                    <Icon className={`w-8 h-8 ${color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest booking activity across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {!bookings ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No bookings yet</p>
              ) : (
                <div className="space-y-1">
                  {bookings.slice(0, 8).map((b: any) => (
                    <div key={b.id} className="flex items-center gap-4 py-2.5 border-b border-border/50 last:border-0 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">{b.id?.slice(0, 8)}…</span>
                      <span className="flex-1 text-foreground truncate">{b.passengerId ?? '—'}</span>
                      <span className="font-mono text-xs text-muted-foreground">{b.flightId?.slice(0, 8)}…</span>
                      {b.totalAmount != null && (
                        <span className="text-foreground font-medium">{formatPrice(b.totalAmount)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${BOOKING_STATUS_STYLE[b.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SERVICES ── */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Checking…'}
            </p>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((svc) => {
              const status = statuses[svc.name];
              return (
                <Card key={svc.name} className={status === 'down' ? 'border-red-500/30' : status === 'up' ? 'border-green-500/20' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-lg flex items-center justify-center ${
                          status === 'up' ? 'bg-green-500/15' :
                          status === 'down' ? 'bg-red-500/15' : 'bg-muted'
                        }`}>
                          <Server className={`w-4 h-4 ${
                            status === 'up' ? 'text-green-400' :
                            status === 'down' ? 'text-red-400' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">:{svc.port}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {status === 'up' && <CheckCircle className="w-4 h-4 text-green-400" />}
                        {status === 'down' && <XCircle className="w-4 h-4 text-red-400" />}
                        {status === 'checking' && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
                        <span className={`text-xs font-medium ${
                          status === 'up' ? 'text-green-400' :
                          status === 'down' ? 'text-red-400' : 'text-muted-foreground'
                        }`}>
                          {status === 'up' ? 'Healthy' : status === 'down' ? 'Unreachable' : 'Checking…'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Infrastructure services */}
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure</CardTitle>
              <CardDescription>Docker-compose services (checked via API gateway)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { name: 'PostgreSQL', desc: 'Port 5432', icon: '🗄️' },
                  { name: 'Redis', desc: 'Port 6379', icon: '⚡' },
                  { name: 'Kafka', desc: 'Port 9092 · 15 topics', icon: '📨' },
                ].map((infra) => (
                  <div key={infra.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-xl">{infra.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{infra.name}</p>
                      <p className="text-xs text-muted-foreground">{infra.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>All registered platform users</CardDescription>
          </CardHeader>
          <CardContent>
            {!users ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No users found. The identity service may not be reachable.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Roles</th>
                      <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-4 text-foreground font-mono text-xs">{u.email}</td>
                        <td className="py-3 pr-4 text-foreground">{u.firstName} {u.lastName}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {(u.roles ?? []).map((role: string) => (
                              <span key={role} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── BOOKINGS ── */}
      {activeTab === 'bookings' && (
        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
            <CardDescription>Platform-wide booking ledger</CardDescription>
          </CardHeader>
          <CardContent>
            {!bookings ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No bookings on the platform yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Booking ID', 'Passenger', 'Flight', 'Seat', 'Amount', 'Status', 'Created'].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b: any) => (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{b.id?.slice(0, 8)}…</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">{b.passengerId?.slice(0, 8) ?? '—'}…</td>
                        <td className="py-3 pr-4 font-mono text-xs">{b.flightId?.slice(0, 8) ?? '—'}…</td>
                        <td className="py-3 pr-4 text-xs">{b.seatNumber ?? '—'}</td>
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {b.totalAmount != null ? formatPrice(b.totalAmount) : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${BOOKING_STATUS_STYLE[b.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
