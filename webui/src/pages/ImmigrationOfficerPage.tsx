import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, Search, AlertTriangle, CheckCircle,
  Clock, User, Plane, Flag, FileText, ChevronDown
} from 'lucide-react';
import { flightsApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';

// Mock immigration clearance statuses
const CLEARANCE_STATUS = ['CLEARED', 'PENDING', 'FLAGGED', 'ADDITIONAL_SCREENING'] as const;
type ClearanceStatus = typeof CLEARANCE_STATUS[number];

const CLEARANCE_STYLE: Record<ClearanceStatus, string> = {
  CLEARED: 'bg-green-500/15 text-green-400',
  PENDING: 'bg-amber-500/15 text-amber-400',
  FLAGGED: 'bg-red-500/15 text-red-400',
  ADDITIONAL_SCREENING: 'bg-orange-500/15 text-orange-400',
};

const CLEARANCE_ICON: Record<ClearanceStatus, typeof CheckCircle> = {
  CLEARED: CheckCircle,
  PENDING: Clock,
  FLAGGED: AlertTriangle,
  ADDITIONAL_SCREENING: AlertTriangle,
};

// Mock passenger data generator
function mockPassengers(flightId: string) {
  const nationalities = ['Singaporean', 'Malaysian', 'Thai', 'Japanese', 'British', 'American', 'Australian', 'Chinese'];
  const docTypes = ['PASSPORT', 'NATIONAL_ID', 'REFUGEE_TRAVEL_DOC'];
  const names = [
    ['James', 'Wilson'], ['Maria', 'Santos'], ['Kenji', 'Tanaka'], ['Sophie', 'Chen'],
    ['Ahmed', 'Al-Rashid'], ['Priya', 'Sharma'], ['Luke', 'Thompson'], ['Ana', 'Silva'],
    ['Mohammed', 'Hassan'], ['Emma', 'Taylor'], ['Carlos', 'Rodriguez'], ['Yuki', 'Yamamoto'],
  ];

  return names.map(([first, last], idx) => ({
    id: `PAX-${flightId.slice(0, 4)}-${String(idx + 1).padStart(3, '0')}`,
    firstName: first,
    lastName: last,
    nationality: nationalities[idx % nationalities.length],
    documentType: docTypes[idx % docTypes.length],
    documentNumber: `P${String(Math.random() * 1e8 | 0).padStart(8, '0')}`,
    dateOfBirth: `${1960 + idx * 3}-${String((idx % 12) + 1).padStart(2, '0')}-15`,
    seat: `${Math.floor(idx / 6) + 1}${String.fromCharCode(65 + (idx % 6))}`,
    clearance: CLEARANCE_STATUS[(idx * 3) % CLEARANCE_STATUS.length] as ClearanceStatus,
    notes: idx === 2 ? 'Document expiry within 6 months of travel date' : idx === 7 ? 'Visa on arrival — verify at desk' : '',
  }));
}

export function ImmigrationOfficerPage() {
  const [flightIdInput, setFlightIdInput] = useState('');
  const [activeFlightId, setActiveFlightId] = useState<string | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: flightData, isLoading } = useQuery({
    queryKey: ['immigration-flight', activeFlightId],
    queryFn: () => flightsApi.getById(activeFlightId!).then((r) => r.data),
    enabled: !!activeFlightId,
  });

  const f = flightData as any;
  const passengers = activeFlightId ? mockPassengers(activeFlightId) : [];

  const filtered = passengers.filter(
    (p) => statusFilter === 'ALL' || p.clearance === statusFilter
  );

  const clearanceCounts = CLEARANCE_STATUS.reduce((acc, s) => {
    acc[s] = passengers.filter((p) => p.clearance === s).length;
    return acc;
  }, {} as Record<ClearanceStatus, number>);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="size-12 rounded-xl bg-primary flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Immigration Control</h1>
          <p className="text-muted-foreground text-sm">Passenger clearance and document verification</p>
        </div>
      </div>

      {/* Flight search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setActiveFlightId(flightIdInput.trim()); setSelectedPassenger(null); }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={flightIdInput}
                onChange={(e) => setFlightIdInput(e.target.value)}
                placeholder="Enter Flight ID (UUID) to load passenger manifest…"
                className="w-full pl-9 pr-3 py-2.5 bg-input/30 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button type="submit" className="gap-2" disabled={!flightIdInput.trim()}>
              <Plane className="w-4 h-4" />
              Load Flight
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Clock className="w-5 h-5 animate-spin mr-2" />
          Loading flight data…
        </div>
      )}

      {f && (
        <>
          {/* Flight summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Flight</p>
                    <p className="text-xl font-bold font-mono">{f.flightNumber ?? activeFlightId?.slice(0, 8) + '…'}</p>
                    <p className="text-sm text-muted-foreground">{f.origin} → {f.destination}</p>
                  </div>
                  <Plane className="w-8 h-8 text-primary opacity-30" />
                </div>
              </CardContent>
            </Card>

            {(Object.entries(clearanceCounts) as [ClearanceStatus, number][]).map(([status, count]) => {
              const Icon = CLEARANCE_ICON[status];
              return (
                <Card key={status} className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}>
                  <CardContent className="p-4 text-center">
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${
                      status === 'CLEARED' ? 'text-green-400' :
                      status === 'FLAGGED' || status === 'ADDITIONAL_SCREENING' ? 'text-red-400' :
                      'text-amber-400'
                    }`} />
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Flag className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter:</span>
            {(['ALL', ...CLEARANCE_STATUS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'ALL' ? 'All Passengers' : s.replace('_', ' ')}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">{filtered.length} of {passengers.length} shown</span>
          </div>

          {/* Passenger list */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Passenger Manifest</CardTitle>
                <CardDescription>Click to view full details</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Passenger</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Seat</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase">Clearance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => {
                        const Icon = CLEARANCE_ICON[p.clearance];
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPassenger(selectedPassenger?.id === p.id ? null : p)}
                            className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors ${
                              selectedPassenger?.id === p.id ? 'bg-primary/10' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                  {p.firstName[0]}
                                </div>
                                <div>
                                  <p className="font-medium">{p.firstName} {p.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{p.nationality}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{p.seat}</td>
                            <td className="py-3 px-4">
                              <span className={`flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full w-fit font-medium ${CLEARANCE_STYLE[p.clearance]}`}>
                                <Icon className="w-3 h-3" />
                                {p.clearance.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Passenger detail */}
            <div>
              {selectedPassenger ? (
                <Card className={selectedPassenger.clearance === 'FLAGGED' ? 'border-red-500/40' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Passenger Details</CardTitle>
                      <button onClick={() => setSelectedPassenger(null)} className="text-muted-foreground hover:text-foreground">
                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedPassenger.clearance === 'FLAGGED' && (
                      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-400">Flagged for review</p>
                          {selectedPassenger.notes && <p className="text-xs text-red-300/80 mt-0.5">{selectedPassenger.notes}</p>}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary">
                        {selectedPassenger.firstName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{selectedPassenger.firstName} {selectedPassenger.lastName}</p>
                        <p className="text-sm text-muted-foreground">{selectedPassenger.nationality}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ['Seat', selectedPassenger.seat],
                        ['Passenger ID', selectedPassenger.id],
                        ['Doc Type', selectedPassenger.documentType],
                        ['Doc Number', selectedPassenger.documentNumber],
                        ['Date of Birth', selectedPassenger.dateOfBirth],
                        ['Clearance', selectedPassenger.clearance.replace('_', ' ')],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                          <p className="font-medium text-sm">{value}</p>
                        </div>
                      ))}
                    </div>

                    {selectedPassenger.notes && selectedPassenger.clearance !== 'FLAGGED' && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300/80">{selectedPassenger.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-500 gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Clear
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Flag
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center border-dashed">
                  <CardContent className="text-center py-12">
                    <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Select a passenger to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {!f && !isLoading && (
        <div className="text-center py-20 text-muted-foreground">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Enter a flight ID above to load the passenger manifest</p>
        </div>
      )}
    </div>
  );
}
