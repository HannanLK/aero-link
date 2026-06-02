import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plane, Clock, Check, ArrowRight, Star, AlertTriangle } from 'lucide-react';
import { flightsApi } from '../lib/api';
import { AirportSelect } from '../components/AirportSelect';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useAuthStore } from '../store/auth.store';
import { allClassPrices, formatPrice, type SeatClass } from '../lib/pricing';
import { findAirport } from '../lib/airports';
import { generateMockFlights } from '../lib/mockFlights';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(dep: string, arr: string) {
  const mins = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60_000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const CLASS_CONFIG: { key: SeatClass; label: string; color: string; badge: string; perks: string[] }[] = [
  {
    key: 'ECONOMY',
    label: 'Economy',
    color: 'border-border',
    badge: 'bg-muted text-muted-foreground',
    perks: ['1× carry-on bag', '20kg checked bag', 'Standard seat', 'In-flight meals'],
  },
  {
    key: 'PREMIUM_ECONOMY',
    label: 'Premium Economy',
    color: 'border-blue-500/50',
    badge: 'bg-blue-500/15 text-blue-400',
    perks: ['2× carry-on bags', '25kg checked bag', 'Extra legroom', 'Priority boarding', 'Enhanced meals'],
  },
  {
    key: 'BUSINESS',
    label: 'Business',
    color: 'border-primary/60',
    badge: 'bg-primary/15 text-primary',
    perks: ['Unlimited bags', 'Lie-flat seat', 'Lounge access', 'Priority check-in', 'Premium dining', 'Fast-track security'],
  },
  {
    key: 'FIRST',
    label: 'First Class',
    color: 'border-amber-500/60',
    badge: 'bg-amber-500/15 text-amber-400',
    perks: ['Suite seating', 'Lounge & spa access', 'Private chauffeur', 'Chef-curated menus', 'Exclusive amenities', 'Dedicated concierge'],
  },
];

export function FlightComparePage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.accessToken);
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    origin: searchParams.get('origin') ?? 'SIN',
    destination: searchParams.get('destination') ?? 'KUL',
    date: searchParams.get('date') ?? new Date(Date.now() + 86400_000).toISOString().split('T')[0],
  });
  const [submitted, setSubmitted] = useState(!!(searchParams.get('origin') && searchParams.get('destination')));

  const { data: apiFlights, isLoading, error: apiError } = useQuery({
    queryKey: ['compare-flights', form.origin, form.destination, form.date],
    queryFn: () => flightsApi.search(form.origin, form.destination, form.date),
    enabled: submitted,
    select: (r) => (r.data.data as any[]).slice(0, 3),
    retry: 1,
  });

  const usingMock = submitted && !isLoading && (!!apiError || !apiFlights?.length);
  const mockData = useMemo(
    () => (usingMock ? generateMockFlights(form.origin, form.destination, form.date).slice(0, 3) : []),
    [usingMock, form.origin, form.destination, form.date],
  );
  const flights: any[] = apiFlights?.length ? apiFlights : mockData;

  const originAirport = findAirport(form.origin);
  const destAirport = findAirport(form.destination);

  function handleBook(flightId: string) {
    if (!token) {
      navigate(`/login?redirect=/flights/${flightId}/book`);
    } else {
      navigate(`/flights/${flightId}/book`);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Compare Flights</h1>
        <p className="text-muted-foreground text-sm">Side-by-side price and class breakdown</p>
      </div>

      {/* Search bar */}
      <div className="bg-card border border-border rounded-xl p-5 mb-8">
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
          className="flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <AirportSelect
              label="From"
              value={form.origin}
              onChange={(v) => { setForm((f) => ({ ...f, origin: v })); setSubmitted(false); }}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <AirportSelect
              label="To"
              value={form.destination}
              onChange={(v) => { setForm((f) => ({ ...f, destination: v })); setSubmitted(false); }}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => { setForm((f) => ({ ...f, date: e.target.value })); setSubmitted(false); }}
              className="w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button type="submit" className="gap-2">
            <Plane className="w-4 h-4" />
            Compare
          </Button>
        </form>
      </div>

      {isLoading && (
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}

      {flights && flights.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Plane className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No flights found for this route.</p>
        </div>
      )}

      {flights && flights.length > 0 && (
        <>
          {usingMock && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl px-4 py-3 mb-4 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Demo mode — showing sample flights. Start backend services for live data.
            </div>
          )}
          <p className="text-sm text-muted-foreground mb-5">
            Showing {flights.length} flight{flights.length !== 1 ? 's' : ''} from{' '}
            <strong className="text-foreground">{originAirport?.city ?? form.origin}</strong> to{' '}
            <strong className="text-foreground">{destAirport?.city ?? form.destination}</strong>
          </p>

          {/* Flight header row */}
          <div className={`grid gap-4 mb-6 ${flights.length === 1 ? 'md:grid-cols-1 max-w-md' : flights.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {flights.map((flight: any, idx: number) => (
              <Card key={flight.id} className={`${idx === 0 ? 'border-primary/40' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Flight {flight.flightNumber}</CardTitle>
                    {idx === 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3" /> Best
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-center">
                      <p className="text-xl font-bold font-mono">{formatTime(flight.scheduledDep)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{flight.origin}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className="w-3 h-3" />
                        {formatDuration(flight.scheduledDep, flight.scheduledArr)}
                      </div>
                      <div className="flex items-center gap-1 w-16">
                        <div className="flex-1 h-px bg-border" />
                        <Plane className="w-3 h-3" />
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <p className="text-xs">Direct</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold font-mono">{formatTime(flight.scheduledArr)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{flight.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`px-2 py-0.5 rounded-full ${
                      flight.status === 'SCHEDULED' ? 'bg-green-500/15 text-green-400' :
                      flight.status === 'DELAYED' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }`}>{flight.status}</span>
                    <span>{flight.availableSeats} seats left</span>
                    {flight.aircraft?.model && <span>{flight.aircraft.model}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Class comparison table */}
          <div className="space-y-4">
            {CLASS_CONFIG.map((cls) => (
              <div key={cls.key} className={`border rounded-xl overflow-hidden ${cls.color}`}>
                <div className="px-4 py-3 bg-muted/30 flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls.badge}`}>
                    {cls.label}
                  </span>
                  <div className="flex gap-3 flex-wrap">
                    {cls.perks.map((p) => (
                      <span key={p} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="w-3 h-3 text-green-500 shrink-0" />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={`grid gap-0 divide-x divide-border ${flights.length === 1 ? 'grid-cols-1' : flights.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {flights.map((flight: any) => {
                    const prices = allClassPrices(flight.origin, flight.destination);
                    const price = prices[cls.key];
                    return (
                      <div key={flight.id} className="p-4 flex flex-col gap-2">
                        <p className="text-2xl font-bold text-foreground">{formatPrice(price)}</p>
                        <p className="text-xs text-muted-foreground">per passenger</p>
                        <Button
                          size="sm"
                          variant={cls.key === 'ECONOMY' ? 'default' : 'outline'}
                          className="gap-1.5 mt-1 w-full"
                          onClick={() => handleBook(flight.id)}
                        >
                          Select {cls.label}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
