import { useState, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2, CheckCircle, Plane, CreditCard, Shield, Lock,
  ArrowRight, Ticket, Clock, AlertTriangle,
} from 'lucide-react';
import { flightsApi, bookingsApi, paymentApi } from '../lib/api';
import { SeatMap } from '../components/SeatMap';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { priceForClass, formatPrice, type SeatClass } from '../lib/pricing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seatClass(seatNumber: string, seats: { seatNumber: string; class: string }[]): SeatClass {
  const seat = seats.find((s) => s.seatNumber === seatNumber);
  return (seat?.class as SeatClass) ?? 'ECONOMY';
}

/** Generate mock seats for demo mode when the backend is unreachable */
function generateMockSeats(): { seatNumber: string; class: string; isAvailable: boolean }[] {
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  const preBooked = new Set(['1A', '1B', '3C', '10D', '15F']);
  const seats: { seatNumber: string; class: string; isAvailable: boolean }[] = [];
  for (let r = 1; r <= 30; r++) {
    const cls = r <= 2 ? 'BUSINESS' : r <= 5 ? 'PREMIUM_ECONOMY' : 'ECONOMY';
    for (const c of cols) {
      const seatNumber = `${r}${c}`;
      seats.push({ seatNumber, class: cls, isAvailable: !preBooked.has(seatNumber) });
    }
  }
  return seats;
}

type BookingStep = 'seat' | 'processing' | 'payment' | 'confirmed';

const STEP_LABELS: Record<BookingStep, string> = {
  seat: 'Seat Selection',
  processing: 'Processing',
  payment: 'Payment',
  confirmed: 'Confirmed',
};

const STEPS: BookingStep[] = ['seat', 'processing', 'payment', 'confirmed'];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: BookingStep }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-6 sm:w-10 transition-colors ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary/15 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  active ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BookingPage() {
  const { flightId } = useParams<{ flightId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();

  // Flight data: prefer router state, fall back to API fetch
  const flightFromState = state?.flight;
  const { data: flightFromApi } = useQuery({
    queryKey: ['flight', flightId],
    queryFn: () => flightsApi.getById(flightId!),
    select: (r) => r.data,
    enabled: !!flightId && !flightFromState,
  });
  const flight = flightFromState ?? flightFromApi;

  const isMockFlight = flightId?.startsWith('mock-');

  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>('seat');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sagaStatus, setSagaStatus] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ─── Seat Map Data ────────────────────────────────────────────────────────
  const { data: seatMapData, isLoading: seatMapLoading } = useQuery({
    queryKey: ['seat-map', flightId],
    queryFn: () => flightsApi.getSeatMap(flightId!),
    select: (r) => r.data.data as { seatNumber: string; class: string; isAvailable: boolean }[],
    enabled: !!flightId && !isMockFlight,
  });

  // Use mock seats when flight ID is mock or API returned nothing
  const mockSeats = useMemo(() => generateMockSeats(), []);
  const seats = isMockFlight ? mockSeats : (seatMapData ?? []);

  const selectedClass = selectedSeat ? seatClass(selectedSeat, seats) : null;
  const price =
    selectedClass && flight
      ? priceForClass(flight.origin ?? '', flight.destination ?? '', selectedClass)
      : null;

  // ─── Saga Status Polling ──────────────────────────────────────────────────
  const pollBookingStatus = useCallback(
    async (id: string, targetStatuses: string[], failStatuses: string[] = ['CANCELLED', 'COMPENSATING']) => {
      const MAX_POLLS = 30;
      const INTERVAL = 2000;
      for (let i = 0; i < MAX_POLLS; i++) {
        try {
          const res = await bookingsApi.getStatus(id);
          const status = res.data.status;
          setSagaStatus(status);
          if (targetStatuses.includes(status)) return status;
          if (failStatuses.includes(status)) throw new Error(`Booking ${status.toLowerCase().replace(/_/g, ' ')}`);
        } catch (err: any) {
          if (err.message?.includes('Booking ')) throw err;
          // network error — keep trying
        }
        await new Promise((r) => setTimeout(r, INTERVAL));
      }
      throw new Error('Timed out waiting for booking status update');
    },
    [],
  );

  // ─── Step 1: Create Booking ───────────────────────────────────────────────
  const handleCreateBooking = async () => {
    if (!selectedSeat || !flightId || price == null) return;
    setError('');
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await bookingsApi.create(
        { flightId, seatNumber: selectedSeat, totalAmount: price },
        idempotencyKey,
      );
      const id = res.data.id;
      setBookingId(id);
      setStep('processing');
      setSagaStatus('AWAITING_SEAT_LOCK');

      // For mock flights, skip saga polling and go straight to payment
      if (isMockFlight) {
        setSagaStatus('AWAITING_PAYMENT');
        setStep('payment');
        setLoading(false);
        return;
      }

      // Poll until saga reaches AWAITING_PAYMENT (seat locked)
      const status = await pollBookingStatus(id, ['AWAITING_PAYMENT']);
      if (status === 'AWAITING_PAYMENT') {
        setStep('payment');
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? 'Booking failed. Try another seat.');
      setStep('seat');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: Process Payment ──────────────────────────────────────────────
  const handlePayment = async () => {
    if (!bookingId || price == null) return;
    setError('');
    setPaymentLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await paymentApi.processPayment(
        {
          bookingId,
          amount: price,
          currency: 'USD',
          stripePaymentMethodId: 'pm_card_visa',
        },
        idempotencyKey,
      );

      // For mock flights, skip polling
      if (isMockFlight) {
        setSagaStatus('CONFIRMED');
        setStep('confirmed');
        setPaymentLoading(false);
        return;
      }

      // Poll until booking is CONFIRMED
      setSagaStatus('AWAITING_CONFIRMATION');
      const status = await pollBookingStatus(bookingId, ['CONFIRMED']);
      if (status === 'CONFIRMED') {
        setStep('confirmed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? 'Payment failed. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─── Flight Info Header ───────────────────────────────────────────────────
  const renderFlightHeader = () => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Plane className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">
          {flight ? `${flight.origin} → ${flight.destination}` : 'Book Your Flight'}
        </h1>
      </div>
      {flight && (
        <p className="text-muted-foreground text-sm">
          Flight {flight.flightNumber} ·{' '}
          {new Date(flight.scheduledDep).toLocaleDateString([], {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      )}
      {isMockFlight && (
        <div className="flex items-center gap-2 mt-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Demo mode — simulated booking flow
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: CONFIRMED
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'confirmed') {
    return (
      <div className="max-w-lg mx-auto py-12">
        <StepIndicator current="confirmed" />
        <div className="text-center">
          <div className="size-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Your flight has been booked and payment processed successfully.
          </p>

          <Card className="text-left mb-8">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Booking ID</span>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{bookingId}</span>
              </div>
              {flight && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Route</span>
                  <span className="font-mono font-medium">{flight.origin} → {flight.destination}</span>
                </div>
              )}
              {flight && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Flight</span>
                  <span className="font-mono">{flight.flightNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Seat</span>
                <span className="font-semibold">{selectedSeat}</span>
              </div>
              {selectedClass && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Class</span>
                  <span className="capitalize">{selectedClass.replace('_', ' ').toLowerCase()}</span>
                </div>
              )}
              {price != null && (
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="font-semibold">Total Paid</span>
                  <span className="text-primary text-lg font-bold">{formatPrice(price)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="bg-green-500/15 text-green-400 text-xs px-2.5 py-1 rounded-full font-medium">
                  CONFIRMED
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/bookings')} className="gap-2">
              <Ticket className="w-4 h-4" /> View My Bookings
            </Button>
            <Button variant="outline" onClick={() => navigate('/checkin')}>
              Check In
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Search More Flights
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: PROCESSING (saga polling)
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'processing') {
    return (
      <div className="max-w-lg mx-auto py-12">
        <StepIndicator current="processing" />
        <div className="text-center">
          <div className="size-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-5 animate-pulse">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h2 className="text-xl font-bold mb-2">Securing Your Seat</h2>
          <p className="text-muted-foreground text-sm mb-6">
            We're locking seat <strong>{selectedSeat}</strong> for you. This usually takes a few seconds.
          </p>
          <div className="space-y-2 max-w-xs mx-auto text-left">
            {[
              { label: 'Booking created', done: true },
              { label: 'Seat lock requested', done: sagaStatus !== 'AWAITING_SEAT_LOCK' },
              { label: 'Seat confirmed', done: sagaStatus === 'AWAITING_PAYMENT' },
            ].map(({ label, done }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                )}
                <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
              </div>
            ))}
          </div>
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mt-6 text-sm max-w-xs mx-auto">
              {error}
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => { setStep('seat'); setError(''); }}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: PAYMENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'payment') {
    return (
      <div className="max-w-lg mx-auto py-8">
        <StepIndicator current="payment" />
        {renderFlightHeader()}

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Payment Details</h3>
            </div>

            {/* Booking summary */}
            <div className="bg-muted/50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seat</span>
                <span className="font-mono font-semibold">{selectedSeat}</span>
              </div>
              {selectedClass && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Class</span>
                  <span className="capitalize">{selectedClass.replace('_', ' ').toLowerCase()}</span>
                </div>
              )}
              {flight && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Route</span>
                  <span className="font-mono">{flight.origin} → {flight.destination}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">{price != null ? formatPrice(price) : '—'}</span>
              </div>
            </div>

            {/* Simulated card form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    defaultValue="4242 4242 4242 4242"
                    readOnly
                    className="w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm font-mono focus:outline-none focus:border-primary pr-10"
                  />
                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">Expiry</label>
                  <input
                    type="text"
                    defaultValue="12/28"
                    readOnly
                    className="w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">CVC</label>
                  <input
                    type="text"
                    defaultValue="123"
                    readOnly
                    className="w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Shield className="w-3.5 h-3.5" />
              <span>Payment secured with PCI-DSS compliant processing. Only last 4 digits are stored.</span>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handlePayment}
              disabled={paymentLoading}
              className="w-full gap-2 h-11"
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Payment…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Pay {price != null ? formatPrice(price) : ''}
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Seat held for 15 minutes during payment
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: SEAT SELECTION (default)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator current="seat" />
      {renderFlightHeader()}

      {seatMapLoading && !isMockFlight ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading seat map…
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          <Card>
            <CardContent className="p-6">
              <SeatMap seats={seats} selectedSeat={selectedSeat} onSelect={setSelectedSeat} />
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Booking Summary</h3>

              {selectedSeat && selectedClass && price != null ? (
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Seat</span>
                    <span className="font-mono font-semibold">{selectedSeat}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Class</span>
                    <span className="capitalize">{selectedClass.replace('_', ' ').toLowerCase()}</span>
                  </div>
                  {flight && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Route</span>
                      <span className="font-mono">{flight.origin} → {flight.destination}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary text-lg">{formatPrice(price)}</span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm mb-2">
                  Select a seat on the map to see pricing
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 mb-4 text-xs">
                  {error}
                </div>
              )}

              <Button
                onClick={handleCreateBooking}
                disabled={!selectedSeat || loading || price == null}
                className="w-full gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Creating Booking…' : 'Continue to Payment'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Seat will be held for 15 minutes while you complete payment
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
