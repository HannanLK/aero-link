import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, Clock, Plane, Loader2 } from 'lucide-react';
import { flightsApi } from '../lib/api';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(dep: string, arr: string) {
  const mins = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60_000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function FlightSearchPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    origin: 'SIN',
    destination: 'KUL',
    date: new Date(Date.now() + 86400_000).toISOString().split('T')[0],
  });
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['flights-search', form.origin, form.destination, form.date],
    queryFn: () => flightsApi.search(form.origin, form.destination, form.date),
    enabled: submitted,
    select: (r) => r.data.data as any[],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white tracking-tight mb-1">Find Flights</h1>
        <p className="text-gray-500 text-sm">Search available routes and book your seat</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          {[
            { label: 'From', key: 'origin', placeholder: 'SIN' },
            { label: 'To', key: 'destination', placeholder: 'KUL' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value.toUpperCase() }))}
                maxLength={3}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white uppercase font-mono text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          ))}

          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>

          <button
            type="submit"
            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Searching flights…
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
          Failed to search flights. Please try again.
        </div>
      )}

      {data && data.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Plane className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No flights found for this route and date.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((flight: any) => (
            <div
              key={flight.id}
              className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition-all group"
              onClick={() => navigate(`/flights/${flight.id}/book`, { state: { flight } })}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-white font-mono">{formatTime(flight.scheduledDep)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{flight.origin}</p>
                  </div>

                  <div className="flex flex-col items-center gap-1 text-gray-600">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDuration(flight.scheduledDep, flight.scheduledArr)}
                    </div>
                    <div className="flex items-center gap-1 w-24">
                      <div className="flex-1 h-px bg-gray-700" />
                      <Plane className="w-3 h-3 text-gray-600" />
                      <div className="flex-1 h-px bg-gray-700" />
                    </div>
                    <p className="text-xs text-gray-600">Direct</p>
                  </div>

                  <div className="text-center">
                    <p className="text-2xl font-semibold text-white font-mono">{formatTime(flight.scheduledArr)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{flight.destination}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{flight.availableSeats} seats left</p>
                    <p className="text-xs text-gray-600 mt-0.5">{flight.aircraft?.model ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      flight.status === 'SCHEDULED' ? 'bg-green-500/15 text-green-400' :
                      flight.status === 'DELAYED' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>
                      {flight.status}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4">
                <span className="text-xs text-gray-600">Flight {flight.flightNumber}</span>
                {flight.gate && <span className="text-xs text-gray-600">Gate {flight.gate}</span>}
                {flight.terminal && <span className="text-xs text-gray-600">Terminal {flight.terminal}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
