import { cn } from '../lib/utils';

type Seat = { seatNumber: string; class: string; isAvailable: boolean };

interface SeatMapProps {
  seats: Seat[];
  selectedSeat: string | null;
  onSelect: (seat: string) => void;
}

const CLASS_COLORS: Record<string, string> = {
  FIRST: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  BUSINESS: 'bg-primary/20 border-primary/40 text-blue-300',
  PREMIUM_ECONOMY: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  ECONOMY: 'bg-muted border-border text-muted-foreground',
};

export function SeatMap({ seats, selectedSeat, onSelect }: SeatMapProps) {
  const rows: Record<string, Seat[]> = {};
  for (const seat of seats) {
    const row = seat.seatNumber.replace(/[A-Z]/g, '');
    if (!rows[row]) rows[row] = [];
    rows[row].push(seat);
  }

  if (seats.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No seat data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 text-xs text-muted-foreground">
        {Object.entries(CLASS_COLORS).map(([cls, color]) => (
          <div key={cls} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded border', color)} />
            <span>{cls.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border bg-gray-800 border-gray-700" />
          <span>Unavailable</span>
        </div>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
        {Object.entries(rows).map(([row, rowSeats]) => (
          <div key={row} className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-6 text-right shrink-0 font-mono">{row}</span>
            <div className="flex gap-1">
              {rowSeats.slice(0, 3).map((seat) => (
                <SeatButton key={seat.seatNumber} seat={seat} selected={selectedSeat === seat.seatNumber} onSelect={onSelect} />
              ))}
            </div>
            <div className="w-4" />
            <div className="flex gap-1">
              {rowSeats.slice(3).map((seat) => (
                <SeatButton key={seat.seatNumber} seat={seat} selected={selectedSeat === seat.seatNumber} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatButton({ seat, selected, onSelect }: { seat: Seat; selected: boolean; onSelect: (s: string) => void }) {
  const col = seat.seatNumber.replace(/\d/g, '');
  const unavailable = !seat.isAvailable;
  const baseClass = CLASS_COLORS[seat.class] ?? CLASS_COLORS.ECONOMY;

  return (
    <button
      disabled={unavailable}
      onClick={() => onSelect(seat.seatNumber)}
      title={seat.seatNumber}
      className={cn(
        'w-8 h-8 rounded text-xs font-mono border transition-all',
        unavailable
          ? 'bg-muted/50 border-border/50 text-muted-foreground/30 cursor-not-allowed'
          : selected
          ? 'bg-primary border-primary/80 text-primary-foreground scale-110 shadow-lg shadow-primary/30'
          : cn(baseClass, 'hover:scale-105 cursor-pointer'),
      )}
    >
      {col}
    </button>
  );
}
