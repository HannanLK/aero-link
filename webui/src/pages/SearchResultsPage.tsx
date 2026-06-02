import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plane, Clock, ArrowRight, Filter, SlidersHorizontal,
  Check, X, ChevronDown, ArrowLeftRight,
  CheckSquare, Square, BarChart2, AlertTriangle
} from 'lucide-react';
import { flightsApi } from '../lib/api';
import { AirportSelect } from '../components/AirportSelect';
import { PassengersSelector, type PassengerCounts } from '../components/PassengersSelector';
import { findAirport } from '../lib/airports';
import { allClassPrices, basePrice, formatPrice, type SeatClass } from '../lib/pricing';
import { generateMockFlights } from '../lib/mockFlights';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/button';

const CABIN_LABELS: Record<string, string> = {
  ECONOMY: 'Economy', PREMIUM_ECONOMY: 'Premium Economy', BUSINESS: 'Business', FIRST: 'First',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(dep: string, arr: string) {
  const mins = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60_000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-green-500/15 text-green-400',
  DELAYED: 'bg-amber-500/15 text-amber-400',
  BOARDING: 'bg-blue-500/15 text-blue-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
};

type SortKey = 'price' | 'duration' | 'departure';

// ─── Compare Panel ────────────────────────────────────────────────────────────

function ComparePanel({
  flights, selected, onClear, onBook,
}: {
  flights: any[]; selected: string[]; onClear: () => void; onBook: (id: string) => void;
}) {
  const sel = flights.filter((f: any) => selected.includes(f.id));
  if (sel.length < 2) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Comparing {sel.length} flights</span>
          <button onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`grid gap-4 ${sel.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {sel.map((f: any) => {
            const prices = allClassPrices(f.origin, f.destination);
            return (
              <div key={f.id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">{f.flightNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[f.status] ?? 'bg-muted text-muted-foreground'}`}>{f.status}</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono">{formatTime(f.scheduledDep)}</p>
                    <p className="text-xs text-muted-foreground">{f.origin}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <p className="text-xs text-muted-foreground">{formatDuration(f.scheduledDep, f.scheduledArr)}</p>
                    <div className="w-full flex items-center gap-1 my-0.5">
                      <div className="flex-1 h-px bg-border" />
                      <Plane className="w-3 h-3 text-muted-foreground" />
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <p className="text-xs text-muted-foreground">Direct</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono">{formatTime(f.scheduledArr)}</p>
                    <p className="text-xs text-muted-foreground">{f.destination}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 mb-3">
                  {(Object.entries(prices) as [SeatClass, number][]).map(([cls, price]) => (
                    <div key={cls} className="text-xs bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">{CABIN_LABELS[cls]}</p>
                      <p className="font-semibold text-foreground">{formatPrice(price)}</p>
                    </div>
                  ))}
                </div>
                <Button size="sm" className="w-full gap-1" onClick={() => onBook(f.id)}>
                  Select <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SearchResultsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.accessToken);
  const [searchParams, setSearchParams] = useSearchParams();

  const [origin, setOrigin] = useState(searchParams.get('origin') ?? 'SIN');
  const [destination, setDestination] = useState(searchParams.get('destination') ?? '');
  const [departDate, setDepartDate] = useState(searchParams.get('departDate') ?? '');
  const [cabinClass, setCabinClass] = useState(searchParams.get('cabin') ?? 'ECONOMY');
  const [passengers, setPassengers] = useState<PassengerCounts>({
    adults: Number(searchParams.get('adults') ?? 1),
    children: Number(searchParams.get('children') ?? 0),
    infants: Number(searchParams.get('infants') ?? 0),
  });

  const [sortBy, setSortBy] = useState<SortKey>('price');
  const [maxPrice, setMaxPrice] = useState(5000);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [searchKey, setSearchKey] = useState(0);

  const enabled = !!(origin && destination && departDate);

  const {
    data: apiFlights,
    isLoading,
    error: apiError,
  } = useQuery({
    queryKey: ['search-results', origin, destination, departDate, searchKey],
    queryFn: () => flightsApi.search(origin, destination, departDate),
    enabled,
    select: (r) => r.data.data as any[],
    retry: 1,
  });

  // Fall back to generated mock data when the flight-service is unreachable.
  // This keeps the UI fully functional in local dev without the backend running.
  const usingMock = enabled && !isLoading && (!!apiError || !apiFlights?.length);
  const mockFlights = useMemo(
    () => (usingMock ? generateMockFlights(origin, destination, departDate) : []),
    [usingMock, origin, destination, departDate],
  );
  const flights: any[] = apiFlights?.length ? apiFlights : mockFlights;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSelectedForCompare([]);
    setSearchKey((k) => k + 1);
    setSearchParams({ origin, destination, departDate, cabin: cabinClass,
      adults: String(passengers.adults), children: String(passengers.children), infants: String(passengers.infants) });
  }

  function handleBook(flightId: string) {
    if (!token) navigate(`/login?redirect=/flights/${flightId}/book`);
    else navigate(`/flights/${flightId}/book`, { state: { flightId } });
  }

  function toggleCompare(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const sortedFlights = useMemo(() => {
    if (!flights) return [];
    const withPrice = flights.map((f: any) => ({
      ...f,
      _price: basePrice(f.origin, f.destination),
      _durationMins: Math.round((new Date(f.scheduledArr).getTime() - new Date(f.scheduledDep).getTime()) / 60_000),
    }));
    const filtered = withPrice.filter((f: any) => f._price <= maxPrice);
    return filtered.sort((a: any, b: any) => {
      if (sortBy === 'price') return a._price - b._price;
      if (sortBy === 'duration') return a._durationMins - b._durationMins;
      return new Date(a.scheduledDep).getTime() - new Date(b.scheduledDep).getTime();
    });
  }, [flights, sortBy, maxPrice]);

  const originAirport = findAirport(origin);
  const destAirport = findAirport(destination);
  const minPrice = useMemo(() => {
    if (!flights?.length) return 0;
    return Math.min(...flights.map((f: any) => basePrice(f.origin, f.destination)));
  }, [flights]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Search bar sticky header ── */}
      <div className="bg-card border-b border-border sticky top-16 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[150px]">
              <AirportSelect label="From" value={origin} onChange={setOrigin} />
            </div>
            <button type="button" onClick={() => { const t = origin; setOrigin(destination); setDestination(t); }}
              className="size-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors mb-0.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 min-w-[150px]">
              <AirportSelect label="To" value={destination} onChange={setDestination} />
            </div>
            <div className="min-w-[130px]">
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">Date</label>
              <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)}
                className="w-full bg-input/30 border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">Cabin</label>
              <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)}
                className="w-full bg-input/30 border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary">
                {Object.entries(CABIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[130px]">
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">Passengers</label>
              <PassengersSelector value={passengers} onChange={setPassengers} />
            </div>
            <Button type="submit" className="gap-1.5 mb-0.5">
              <Plane className="w-4 h-4" />
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Results header */}
        {enabled && (
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold">
                {originAirport?.city ?? origin} → {destAirport?.city ?? destination}
              </h1>
              {departDate && (
                <p className="text-sm text-muted-foreground">
                  {new Date(departDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}{CABIN_LABELS[cabinClass]}
                  {' · '}{passengers.adults + passengers.children + passengers.infants} passenger{passengers.adults + passengers.children + passengers.infants !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedForCompare.length > 0 && (
                <span className="text-xs bg-primary/15 text-primary px-3 py-1.5 rounded-full font-medium">
                  {selectedForCompare.length} selected for compare
                </span>
              )}
              {/* Sort */}
              <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden text-xs">
                {([
                  ['price', 'Cheapest'],
                  ['duration', 'Fastest'],
                  ['departure', 'Earliest'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setSortBy(key)}
                    className={`px-3 py-2 transition-colors ${sortBy === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowFilter((f) => !f)}
                className={`flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-xs transition-colors ${showFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-5">
          {/* ── Filter sidebar ── */}
          {showFilter && (
            <div className="w-60 shrink-0 space-y-5">
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </h3>

                {/* Price range */}
                <div className="mb-4">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Max Price</label>
                  <input type="range" min={minPrice || 100} max={5000} step={50} value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{formatPrice(minPrice || 100)}</span>
                    <span className="font-semibold text-foreground">{formatPrice(maxPrice)}</span>
                  </div>
                </div>

                {/* Stops */}
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Stops</label>
                  {['Direct', '1 Stop', '2+ Stops'].map((s) => (
                    <label key={s} className="flex items-center gap-2 py-1.5 cursor-pointer">
                      <Check className="w-4 h-4 text-primary" />
                      <span className="text-sm">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Results list ── */}
          <div className="flex-1 min-w-0">
            {!enabled && (
              <div className="text-center py-20 text-muted-foreground">
                <Plane className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Enter your search details above to find flights</p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {/* Mock data notice — only shown when backend is unreachable */}
            {usingMock && flights.length > 0 && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-4 mb-4 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Demo mode — showing sample flights</p>
                  <p className="text-amber-400/70 text-xs mt-0.5">
                    The flight service is not reachable locally. Start <code className="font-mono">npm run dev</code> in the services directory to load live data.
                  </p>
                </div>
              </div>
            )}

            {sortedFlights.length === 0 && !isLoading && enabled && !usingMock && (
              <div className="text-center py-20 text-muted-foreground">
                <Plane className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No flights found</p>
                <p className="text-sm mt-1">Try adjusting your filters or search for different dates</p>
              </div>
            )}

            {sortedFlights.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {sortedFlights.length} flight{sortedFlights.length !== 1 ? 's' : ''} found
                  {selectedForCompare.length > 0 && ` · Select up to ${3 - selectedForCompare.length} more to compare`}
                </p>

                <div className="space-y-3 pb-40">
                  {sortedFlights.map((flight: any) => {
                    const prices = allClassPrices(flight.origin, flight.destination);
                    const displayPrice = prices[cabinClass as SeatClass] ?? prices.ECONOMY;
                    const isSelected = selectedForCompare.includes(flight.id);

                    return (
                      <div
                        key={flight.id}
                        className={`bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${
                          isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Flight times */}
                          <div className="flex items-center gap-5 flex-1">
                            <div className="text-center">
                              <p className="text-2xl font-bold font-mono tabular-nums">{formatTime(flight.scheduledDep)}</p>
                              <p className="text-xs text-muted-foreground font-mono">{flight.origin}</p>
                              {findAirport(flight.origin) && (
                                <p className="text-xs text-muted-foreground hidden md:block">{findAirport(flight.origin)?.city}</p>
                              )}
                            </div>

                            <div className="flex flex-col items-center gap-1 flex-1 max-w-[120px] mx-auto">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(flight.scheduledDep, flight.scheduledArr)}
                              </span>
                              <div className="w-full flex items-center gap-1">
                                <div className="flex-1 h-px bg-border" />
                                <Plane className="w-3 h-3 text-muted-foreground" />
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              <span className="text-xs text-muted-foreground">Direct</span>
                            </div>

                            <div className="text-center">
                              <p className="text-2xl font-bold font-mono tabular-nums">{formatTime(flight.scheduledArr)}</p>
                              <p className="text-xs text-muted-foreground font-mono">{flight.destination}</p>
                              {findAirport(flight.destination) && (
                                <p className="text-xs text-muted-foreground hidden md:block">{findAirport(flight.destination)?.city}</p>
                              )}
                            </div>
                          </div>

                          {/* Price + actions */}
                          <div className="flex flex-col items-end gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">{CABIN_LABELS[cabinClass]}</p>
                              <p className="text-2xl font-bold text-primary tabular-nums">{formatPrice(displayPrice)}</p>
                              <p className="text-xs text-muted-foreground">per person</p>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Compare checkbox */}
                              <button
                                onClick={() => toggleCompare(flight.id)}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-primary/15 border-primary text-primary'
                                    : 'border-border text-muted-foreground hover:border-primary/40'
                                }`}
                              >
                                {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                Compare
                              </button>

                              <Button size="sm" className="gap-1" onClick={() => handleBook(flight.id)}>
                                Select <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Footer info */}
                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 flex-wrap">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[flight.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {flight.status}
                          </span>
                          <span className="text-xs text-muted-foreground">Flight {flight.flightNumber}</span>
                          {flight.gate && <span className="text-xs text-muted-foreground">Gate {flight.gate}</span>}
                          {flight.terminal && <span className="text-xs text-muted-foreground">Terminal {flight.terminal}</span>}
                          {flight.aircraft?.model && <span className="text-xs text-muted-foreground">{flight.aircraft.model}</span>}
                          <span className="text-xs text-muted-foreground">{flight.availableSeats} seats left</span>

                          {/* Price breakdown for all classes */}
                          <div className="ml-auto flex items-center gap-3 flex-wrap">
                            {(Object.entries(prices) as [string, number][]).map(([cls, price]) => (
                              <div key={cls} className="text-right">
                                <p className="text-xs text-muted-foreground">{CABIN_LABELS[cls]}</p>
                                <p className="text-xs font-semibold text-foreground">{formatPrice(price)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Floating Compare Panel ── */}
      <ComparePanel
        flights={flights ?? []}
        selected={selectedForCompare}
        onClear={() => setSelectedForCompare([])}
        onBook={handleBook}
      />
    </div>
  );
}
