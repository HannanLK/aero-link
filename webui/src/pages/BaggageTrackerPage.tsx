import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Package, ArrowRight } from 'lucide-react';
import { baggageApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const STATUS_STYLES: Record<string, string> = {
  TAGGED: 'bg-muted text-muted-foreground',
  CHECKED_IN: 'bg-blue-500/15 text-blue-400',
  LOADED: 'bg-indigo-500/15 text-indigo-400',
  IN_TRANSIT: 'bg-primary/15 text-primary',
  ARRIVED: 'bg-cyan-500/15 text-cyan-400',
  COLLECTED: 'bg-green-500/15 text-green-400',
  LOST: 'bg-red-500/15 text-red-400',
};

const TRANSITIONS: Record<string, string[]> = {
  TAGGED: ['CHECKED_IN'],
  CHECKED_IN: ['LOADED'],
  LOADED: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED'],
  ARRIVED: ['COLLECTED', 'LOST'],
  COLLECTED: [],
  LOST: [],
};

export function BaggageTrackerPage() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchId, setSearchId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const qc = useQueryClient();
  const isBaggageHandler = useAuthStore((s) => s.hasRole('BAGGAGE_HANDLER'));

  const { data, isLoading, error } = useQuery({
    queryKey: ['baggage', searchId],
    queryFn: () => baggageApi.getItem(searchId!).then((r) => r.data),
    enabled: !!searchId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ newStatus }: { newStatus: string }) =>
      baggageApi.updateStatus(searchId!, newStatus, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baggage', searchId] });
      setNote('');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchId(barcodeInput.trim());
  };

  const item = data as any;
  const allowed: string[] = item ? (item.allowedTransitions ?? TRANSITIONS[item.status] ?? []) : [];

  const inputClass =
    'flex-1 bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Baggage Tracker</h1>
      <p className="text-muted-foreground text-sm mb-8">Scan or enter a baggage barcode to track and update status</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          placeholder="Baggage ID or barcode…"
          className={inputClass}
        />
        <Button type="submit" className="gap-2">
          <Search className="w-4 h-4" />
          Look Up
        </Button>
      </form>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Fetching baggage record…
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
          Baggage record not found.
        </div>
      )}

      {item && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-mono text-sm text-foreground truncate">{item.id}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <div>Booking: <span className="text-foreground font-mono text-xs">{item.bookingId}</span></div>
                  <div>Flight: <span className="text-foreground font-mono text-xs">{item.flightId}</span></div>
                  {item.weight && <div>Weight: <span className="text-foreground">{item.weight} kg</span></div>}
                </div>
              </div>
            </div>

            {item.history && item.history.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">History</h3>
                <div className="space-y-2">
                  {item.history.map((h: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[h.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {h.status}
                      </span>
                      {h.note && <span className="text-muted-foreground text-xs">— {h.note}</span>}
                      <span className="text-muted-foreground text-xs ml-auto">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isBaggageHandler && allowed.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Update Status</h3>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note…"
                  className="w-full bg-input/30 border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 mb-3"
                />
                <div className="flex flex-wrap gap-2">
                  {allowed.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateMutation.mutate({ newStatus: s })}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-1.5 bg-muted hover:bg-accent border border-border text-foreground rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-primary" />
                      {s}
                    </button>
                  ))}
                </div>
                {updateMutation.isError && (
                  <p className="text-destructive text-xs mt-2">Update failed. Please try again.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
