import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket, XCircle } from 'lucide-react';
import { bookingsApi } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { formatPrice } from '../lib/pricing';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  AWAITING_SEAT_LOCK: 'bg-blue-500/15 text-blue-400',
  SEAT_LOCKED: 'bg-blue-500/15 text-blue-400',
  AWAITING_PAYMENT: 'bg-amber-500/15 text-amber-400',
  CONFIRMED: 'bg-green-500/15 text-green-400',
  COMPENSATING: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
};

export function MyBookingsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingsApi.list(),
    select: (r) => r.data.items as any[],
  });

  const handleCancel = async (id: string) => {
    await bookingsApi.cancel(id);
    refetch();
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading bookings…
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

      {(!data || data.length === 0) && (
        <div className="text-center py-16 text-muted-foreground">
          <Ticket className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No bookings yet</p>
          <p className="text-sm mt-1">Search for flights and book your first trip</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((booking: any) => (
          <Card key={booking.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">Seat {booking.seatNumber}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{booking.id}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(booking.createdAt).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[booking.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {booking.status.replace(/_/g, ' ')}
                  </span>
                  {['PENDING', 'AWAITING_SEAT_LOCK', 'SEAT_LOCKED', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(booking.status) && (
                    <button
                      onClick={() => handleCancel(booking.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Cancel booking"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {booking.totalAmount != null ? formatPrice(Number(booking.totalAmount)) : '—'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {booking.flightId ? `Flight ${booking.flightId.slice(0, 8)}…` : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
