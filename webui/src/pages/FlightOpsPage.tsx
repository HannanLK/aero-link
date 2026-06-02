import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plane, RefreshCw } from 'lucide-react';
import { flightsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const STATUS_OPTIONS = ['SCHEDULED', 'BOARDING', 'DEPARTED', 'IN_AIR', 'LANDED', 'ARRIVED', 'DELAYED', 'CANCELLED'];

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-green-500/15 text-green-400',
  BOARDING: 'bg-blue-500/15 text-blue-400',
  DEPARTED: 'bg-indigo-500/15 text-indigo-400',
  IN_AIR: 'bg-primary/15 text-primary',
  LANDED: 'bg-cyan-500/15 text-cyan-400',
  ARRIVED: 'bg-teal-500/15 text-teal-400',
  DELAYED: 'bg-amber-500/15 text-amber-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
};

export function FlightOpsPage() {
  const [searchFlightId, setSearchFlightId] = useState('');
  const [activeFlightId, setActiveFlightId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const qc = useQueryClient();

  const { data: flight, isLoading, error } = useQuery({
    queryKey: ['flight-ops', activeFlightId],
    queryFn: () => flightsApi.getById(activeFlightId!).then((r) => r.data),
    enabled: !!activeFlightId,
  });

  const updateMutation = useMutation({
    mutationFn: () => flightsApi.updateStatus(activeFlightId!, selectedStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flight-ops', activeFlightId] });
      setSelectedStatus('');
    },
  });

  const f = flight as any;

  const inputClass =
    'flex-1 bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Flight Operations</h1>
      <p className="text-muted-foreground text-sm mb-8">Look up a flight and update its operational status</p>

      <form
        onSubmit={(e) => { e.preventDefault(); setActiveFlightId(searchFlightId.trim()); }}
        className="flex gap-2 mb-8"
      >
        <input
          value={searchFlightId}
          onChange={(e) => setSearchFlightId(e.target.value)}
          placeholder="Flight ID (uuid)…"
          className={inputClass}
        />
        <Button type="submit" className="gap-2">
          <Plane className="w-4 h-4" />
          Load
        </Button>
      </form>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading flight…
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
          Flight not found.
        </div>
      )}

      {f && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{f.flightNumber ?? f.id}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[f.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {f.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{f.origin} → {f.destination}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Departure', f.scheduledDeparture ? new Date(f.scheduledDeparture).toLocaleString() : '—'],
                ['Arrival', f.scheduledArrival ? new Date(f.scheduledArrival).toLocaleString() : '—'],
                ['Aircraft', f.aircraft?.registration ?? '—'],
                ['Gate', f.gate ?? '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-muted-foreground text-xs mb-0.5">{label}</div>
                  <div className="text-foreground font-medium">{val as string}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Update Status</h3>
              <div className="flex gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select new status…</option>
                  {STATUS_OPTIONS.filter((s) => s !== f.status).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={!selectedStatus || updateMutation.isPending}
                  className="gap-2"
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Apply
                </Button>
              </div>
              {updateMutation.isSuccess && (
                <p className="text-green-400 text-xs mt-2">Status updated successfully.</p>
              )}
              {updateMutation.isError && (
                <p className="text-destructive text-xs mt-2">Update failed. Please try again.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
