import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, ScanLine, CheckCircle2, XCircle } from 'lucide-react';
import { flightsApi, checkinApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const CHECKIN_STATUS_STYLES: Record<string, string> = {
  NOT_CHECKED_IN: 'bg-muted text-muted-foreground',
  CHECKED_IN: 'bg-blue-500/15 text-blue-400',
  BOARDING_PASS_ISSUED: 'bg-primary/15 text-primary',
  BOARDED: 'bg-green-500/15 text-green-400',
};

export function GateAgentPage() {
  const [flightIdInput, setFlightIdInput] = useState('');
  const [activeFlightId, setActiveFlightId] = useState<string | null>(null);
  const [boardingId, setBoardingId] = useState('');
  const [boardResult, setBoardResult] = useState<{ success: boolean; message: string } | null>(null);
  const qc = useQueryClient();

  const { data: manifest, isLoading: manifestLoading, error: manifestError } = useQuery({
    queryKey: ['manifest', activeFlightId],
    queryFn: () => flightsApi.getManifest(activeFlightId!).then((r) => r.data),
    enabled: !!activeFlightId,
    refetchInterval: 15_000,
  });

  const boardMutation = useMutation({
    mutationFn: () => checkinApi.board(boardingId.trim()),
    onSuccess: () => {
      setBoardResult({ success: true, message: 'Passenger boarded successfully.' });
      setBoardingId('');
      qc.invalidateQueries({ queryKey: ['manifest', activeFlightId] });
    },
    onError: (err: any) => {
      setBoardResult({ success: false, message: err.response?.data?.message ?? 'Board failed.' });
    },
  });

  const passengers = (manifest as any)?.passengers ?? [];
  const boarded = passengers.filter((p: any) => p.checkinStatus === 'BOARDED').length;
  const total = passengers.length;
  const boardedPct = total > 0 ? (boarded / total) * 100 : 0;

  const inputClass =
    'flex-1 bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Gate Agent</h1>
      <p className="text-muted-foreground text-sm mb-8">Load a flight manifest and board passengers</p>

      <form
        onSubmit={(e) => { e.preventDefault(); setActiveFlightId(flightIdInput.trim()); setBoardResult(null); }}
        className="flex gap-2 mb-8"
      >
        <input
          value={flightIdInput}
          onChange={(e) => setFlightIdInput(e.target.value)}
          placeholder="Flight ID (uuid)…"
          className={inputClass}
        />
        <Button type="submit" className="gap-2">
          <Users className="w-4 h-4" />
          Load Manifest
        </Button>
      </form>

      {manifestLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading manifest…
        </div>
      )}

      {manifestError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm mb-6">
          Could not load manifest for this flight.
        </div>
      )}

      {manifest && (
        <div className="space-y-4">
          {/* Boarding progress */}
          <Card>
            <CardContent className="py-4 px-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Boarded</p>
                  <p className="text-3xl font-bold">{boarded} <span className="text-muted-foreground text-lg font-normal">/ {total}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{Math.round(boardedPct)}%</p>
                  <p className="text-xs text-muted-foreground">complete</p>
                </div>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${boardedPct}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Board passenger */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Board Passenger</h3>
              <div className="flex gap-2">
                <input
                  value={boardingId}
                  onChange={(e) => { setBoardingId(e.target.value); setBoardResult(null); }}
                  placeholder="Booking ID or scan boarding pass…"
                  className={inputClass}
                />
                <Button
                  onClick={() => boardMutation.mutate()}
                  disabled={!boardingId.trim() || boardMutation.isPending}
                  className="gap-2 bg-green-600 hover:bg-green-500"
                >
                  {boardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                  Board
                </Button>
              </div>
              {boardResult && (
                <div className={`flex items-center gap-2 mt-2 text-sm ${boardResult.success ? 'text-green-400' : 'text-destructive'}`}>
                  {boardResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {boardResult.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Passenger manifest */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Passenger Manifest</h3>
            </div>
            <div className="divide-y divide-border">
              {passengers.length === 0 && (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">No passengers found.</div>
              )}
              {passengers.map((p: any) => (
                <div key={p.bookingId} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {(p.passengerName ?? p.passengerId ?? '?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{p.passengerName ?? p.passengerId}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Seat <span className="font-mono text-foreground">{p.seatNumber}</span>
                      {p.bagCount > 0 && <span className="ml-2">{p.bagCount} bag{p.bagCount !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${CHECKIN_STATUS_STYLES[p.checkinStatus] ?? 'bg-muted text-muted-foreground'}`}>
                    {p.checkinStatus?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
