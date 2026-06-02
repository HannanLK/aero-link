import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle, Plane } from 'lucide-react';
import { flightsApi, bookingsApi } from '../lib/api';
import { SeatMap } from '../components/SeatMap';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { priceForClass, formatPrice, type SeatClass } from '../lib/pricing';

function seatClass(seatNumber: string, seats: { seatNumber: string; class: string }[]): SeatClass {
  const seat = seats.find((s) => s.seatNumber === seatNumber);
  return (seat?.class as SeatClass) ?? 'ECONOMY';
}

export function BookingPage() {
  const { flightId } = useParams<{ flightId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const flight = state?.flight;

  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [step, setStep] = useState<'seat' | 'done'>('seat');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: seatMapData, isLoading: seatMapLoading } = useQuery({
    queryKey: ['seat-map', flightId],
    queryFn: () => flightsApi.getSeatMap(flightId!),
    select: (r) => r.data.data as { seatNumber: string; class: string; isAvailable: boolean }[],
  });

  const selectedClass = selectedSeat && seatMapData ? seatClass(selectedSeat, seatMapData) : null;
  const price = selectedClass && flight
    ? priceForClass(flight.origin ?? '', flight.destination ?? '', selectedClass)
    : null;

  const handleBook = async () => {
    if (!selectedSeat || !flightId || price == null) return;
    setError('');
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await bookingsApi.create(
        { flightId, seatNumber: selectedSeat, totalAmount: price },
        idempotencyKey,
      );
      setBookingId(res.data.id);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Booking failed. Try another seat.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="size-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Booking Submitted</h2>
        <p className="text-muted-foreground text-sm mb-2">
          Your booking is being processed. Seat <strong>{selectedSeat}</strong> is held for 15 minutes.
        </p>
        <p className="text-xs text-muted-foreground font-mono mb-8">Booking ID: {bookingId}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/bookings')}>View My Bookings</Button>
          <Button variant="outline" onClick={() => navigate('/')}>Search More Flights</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Plane className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">
            {flight ? `${flight.origin} → ${flight.destination}` : 'Select a Seat'}
          </h1>
        </div>
        {flight && (
          <p className="text-muted-foreground text-sm">
            Flight {flight.flightNumber} · {new Date(flight.scheduledDep).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      {seatMapLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading seat map…
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          <Card>
            <CardContent className="p-6">
              <SeatMap seats={seatMapData ?? []} selectedSeat={selectedSeat} onSelect={setSelectedSeat} />
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
                onClick={handleBook}
                disabled={!selectedSeat || loading}
                className="w-full gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing…' : 'Confirm Booking'}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Payment collected after seat confirmation
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
