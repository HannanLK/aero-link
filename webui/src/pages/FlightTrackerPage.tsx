import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Plane, Clock, MapPin, Info, X, RefreshCw } from 'lucide-react';
import { findAirport, distanceKm } from '../lib/airports';

// ─── Mock flight data ─────────────────────────────────────────────────────────

interface MockFlight {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  status: 'EN_ROUTE' | 'LANDING' | 'DEPARTING' | 'DELAYED';
  aircraft: string;
  altitude: number;
  speed: number;
  progress: number; // 0–1
  lat: number;
  lng: number;
}

function interpolate(lat1: number, lng1: number, lat2: number, lng2: number, t: number): [number, number] {
  return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t];
}

function generateFlights(): MockFlight[] {
  const routes = [
    ['SIN', 'KUL'], ['SIN', 'BKK'], ['SIN', 'NRT'], ['SIN', 'DXB'],
    ['SIN', 'LHR'], ['SIN', 'SYD'], ['NRT', 'ICN'], ['DXB', 'LHR'],
    ['CDG', 'FRA'], ['JFK', 'LHR'], ['LAX', 'NRT'], ['SYD', 'AKL'],
    ['HKG', 'PVG'], ['ICN', 'HND'], ['BKK', 'DEL'], ['SIN', 'CGK'],
    ['KUL', 'BOM'], ['DXB', 'DOH'], ['AMS', 'CDG'], ['FRA', 'MAD'],
  ];

  return routes.map(([origin, dest], idx) => {
    const o = findAirport(origin);
    const d = findAirport(dest);
    if (!o || !d) return null;

    const progress = (idx * 0.13 + 0.1) % 1;
    const [lat, lng] = interpolate(o.lat, o.lng, d.lat, d.lng, progress);
    const statuses: MockFlight['status'][] = ['EN_ROUTE', 'LANDING', 'DEPARTING', 'DELAYED'];

    return {
      id: `ARL${1000 + idx}`,
      flightNumber: `ARL${1000 + idx}`,
      origin, destination: dest,
      status: statuses[idx % statuses.length],
      aircraft: ['A380', 'B777', 'A350', 'B787'][idx % 4],
      altitude: Math.round(30000 + Math.random() * 8000),
      speed: Math.round(800 + Math.random() * 100),
      progress,
      lat, lng,
    };
  }).filter(Boolean) as MockFlight[];
}

// ─── Custom plane icon ────────────────────────────────────────────────────────

function createPlaneIcon(color: string) {
  return L.divIcon({
    html: `<div style="color:${color};font-size:20px;transform:rotate(45deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">✈</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const STATUS_COLORS: Record<MockFlight['status'], string> = {
  EN_ROUTE: '#2E4A7A',
  LANDING: '#16a34a',
  DEPARTING: '#d97706',
  DELAYED: '#dc2626',
};

// ─── Component ────────────────────────────────────────────────────────────────

function MapResizer() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 100); }, [map]);
  return null;
}

export function FlightTrackerPage() {
  const [flights, setFlights] = useState<MockFlight[]>(() => generateFlights());
  const [selected, setSelected] = useState<MockFlight | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const animRef = useRef<number>(0);

  // Animate flight positions
  useEffect(() => {
    const step = () => {
      setFlights((prev) =>
        prev.map((f) => {
          const o = findAirport(f.origin);
          const d = findAirport(f.destination);
          if (!o || !d) return f;
          const newProgress = (f.progress + 0.0002) % 1;
          const [lat, lng] = interpolate(o.lat, o.lng, d.lat, d.lng, newProgress);
          return { ...f, progress: newProgress, lat, lng };
        })
      );
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const filteredFlights = flights.filter((f) => {
    const matchSearch = !searchQuery ||
      f.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const selectedOrigin = selected ? findAirport(selected.origin) : null;
  const selectedDest = selected ? findAirport(selected.destination) : null;
  const flightPath: [number, number][] = selectedOrigin && selectedDest
    ? [[selectedOrigin.lat, selectedOrigin.lng], [selected!.lat, selected!.lng], [selectedDest.lat, selectedDest.lng]]
    : [];

  return (
    <div className="flex flex-col bg-background" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm">AeroLink Flight Tracker</h1>
            <p className="text-xs text-muted-foreground">{flights.length} flights tracked live</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by flight or airport…"
            className="bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none flex-1"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(['ALL', 'EN_ROUTE', 'LANDING', 'DEPARTING', 'DELAYED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {s === 'ALL' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={() => setFlights(generateFlights())}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Flight list sidebar ── */}
        <div className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto">
          {filteredFlights.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No flights match your search</div>
          ) : (
            filteredFlights.map((f) => {
              const o = findAirport(f.origin);
              const d = findAirport(f.destination);
              void (o && d ? distanceKm(o, d) : null); // distance available for future use
              const isActive = selected?.id === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setSelected(isActive ? null : f)}
                  className={`px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50 ${isActive ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-semibold">{f.flightNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium`}
                      style={{ backgroundColor: STATUS_COLORS[f.status] + '25', color: STATUS_COLORS[f.status] }}>
                      {f.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-mono font-semibold">{f.origin}</span>
                    <Plane className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono font-semibold">{f.destination}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{f.aircraft}</span>
                    <span>{f.altitude.toLocaleString()} ft</span>
                    <span>{f.speed} km/h</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Map ── */}
        <div className="flex-1 relative">
          <MapContainer
            center={[20, 100]}
            zoom={3}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <MapResizer />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Flight path for selected */}
            {flightPath.length > 0 && (
              <Polyline
                positions={flightPath}
                color="#2E4A7A"
                weight={2}
                dashArray="6 4"
                opacity={0.8}
              />
            )}

            {/* Flight markers */}
            {filteredFlights.map((f) => (
              <Marker
                key={f.id}
                position={[f.lat, f.lng]}
                icon={createPlaneIcon(selected?.id === f.id ? '#60a5fa' : STATUS_COLORS[f.status])}
                eventHandlers={{ click: () => setSelected(selected?.id === f.id ? null : f) }}
              >
                <Popup>
                  <div className="text-xs font-sans min-w-[180px]">
                    <p className="font-bold text-sm mb-1">{f.flightNumber}</p>
                    <p className="text-gray-600">{findAirport(f.origin)?.city} → {findAirport(f.destination)?.city}</p>
                    <div className="mt-2 space-y-0.5">
                      <p><span className="text-gray-500">Status:</span> {f.status.replace('_', ' ')}</p>
                      <p><span className="text-gray-500">Aircraft:</span> {f.aircraft}</p>
                      <p><span className="text-gray-500">Altitude:</span> {f.altitude.toLocaleString()} ft</p>
                      <p><span className="text-gray-500">Speed:</span> {f.speed} km/h</p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* ── Selected flight detail card ── */}
          {selected && (
            <div className="absolute bottom-4 right-4 z-[1000] bg-card border border-border rounded-2xl shadow-2xl p-5 w-80">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">{selected.flightNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: STATUS_COLORS[selected.status] + '25', color: STATUS_COLORS[selected.status] }}>
                      {selected.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.aircraft}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xl font-bold font-mono">{selected.origin}</p>
                  <p className="text-xs text-muted-foreground">{selectedOrigin?.city}</p>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-center gap-1">
                    <div className="flex-1 h-px bg-border" />
                    <Plane className="w-4 h-4 text-primary" />
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.round(selected.progress * 100)}% complete</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold font-mono">{selected.destination}</p>
                  <p className="text-xs text-muted-foreground">{selectedDest?.city}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-4">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${selected.progress * 100}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Altitude', value: `${selected.altitude.toLocaleString()} ft`, icon: MapPin },
                  { label: 'Speed', value: `${selected.speed} km/h`, icon: Clock },
                  { label: 'Progress', value: `${Math.round(selected.progress * 100)}%`, icon: Info },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-muted/50 rounded-xl p-2.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-4 left-4 z-[1000] bg-card/90 backdrop-blur-sm border border-border rounded-xl p-3">
            <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Status</p>
            {(Object.entries(STATUS_COLORS) as [MockFlight['status'], string][]).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-foreground">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
