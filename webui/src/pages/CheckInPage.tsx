import { useState } from 'react';
import { CheckCircle, Loader2, QrCode } from 'lucide-react';
import { checkinApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function CheckInPage() {
  const [bookingId, setBookingId] = useState('');
  const [flightId, setFlightId] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await checkinApi.checkin({ bookingId, flightId, seatNumber, bagCount });
      const qrRes = await checkinApi.getBoardingPassQr(bookingId);
      setQrCode(qrRes.data.qrCode ?? null);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-input/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="size-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Check-in Complete</h2>
        <p className="text-muted-foreground text-sm mb-8">Your boarding pass has been generated.</p>

        {qrCode ? (
          <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
            <img src={`data:image/png;base64,${qrCode}`} alt="Boarding pass QR code" className="w-48 h-48" />
          </div>
        ) : (
          <Card className="inline-block p-8">
            <QrCode className="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">QR code processing…</p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Web Check-In</h1>
      <p className="text-muted-foreground text-sm mb-8">Check in for your flight and get your boarding pass</p>

      <Card>
        <CardContent className="p-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCheckin} className="space-y-4">
            {[
              { label: 'Booking ID', value: bookingId, setter: setBookingId, placeholder: 'uuid', required: true },
              { label: 'Flight ID', value: flightId, setter: setFlightId, placeholder: 'uuid', required: true },
              { label: 'Seat Number', value: seatNumber, setter: setSeatNumber, placeholder: '14A', required: true },
            ].map(({ label, value, setter, placeholder, required }) => (
              <div key={label}>
                <label className="block text-sm text-muted-foreground mb-1.5">{label}</label>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  required={required}
                  className={inputClass}
                />
              </div>
            ))}

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Number of Bags</label>
              <select
                value={bagCount}
                onChange={(e) => setBagCount(Number(e.target.value))}
                className={inputClass}
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'bag' : 'bags'}</option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2 mt-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Check In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
