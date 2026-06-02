import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}

interface Props {
  value: PassengerCounts;
  onChange: (v: PassengerCounts) => void;
  variant?: 'default' | 'dark';
}

export function PassengersSelector({ value, onChange, variant = 'default' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const total = value.adults + value.children + value.infants;
  const dark = variant === 'dark';

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 280) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function adjust(key: keyof PassengerCounts, delta: number) {
    const next = { ...value, [key]: Math.max(key === 'adults' ? 1 : 0, value[key] + delta) };
    if (next.adults + next.children + next.infants > 9) return;
    if (next.infants > next.adults) return;
    onChange(next);
  }

  const rows: { key: keyof PassengerCounts; label: string; sub: string; min: number }[] = [
    { key: 'adults',   label: 'Adults',   sub: '12+ years',            min: 1 },
    { key: 'children', label: 'Children', sub: '2–11 years',            min: 0 },
    { key: 'infants',  label: 'Infants',  sub: 'Under 2 · on lap',     min: 0 },
  ];

  const triggerCls = cn(
    'w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm transition-all',
    dark
      ? cn(
          'bg-white/10 border border-white/20 text-white',
          open ? 'border-white/50 bg-white/15 ring-2 ring-white/20' : 'hover:bg-white/15',
        )
      : cn(
          'bg-background border border-border text-foreground shadow-sm',
          open ? 'border-primary ring-2 ring-primary/20' : 'hover:border-border/80',
        ),
  );

  const iconCls = dark ? 'text-white/50' : 'text-muted-foreground';

  const dropdown = open && createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-xl shadow-2xl p-4"
    >
      {rows.map(({ key, label, sub, min }) => (
        <div key={key} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjust(key, -1)}
              disabled={value[key] <= min}
              className="size-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{value[key]}</span>
            <button
              type="button"
              onClick={() => adjust(key, 1)}
              disabled={total >= 9 || (key === 'infants' && value.infants >= value.adults)}
              className="size-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-3 mb-3 leading-relaxed">
        Max 9 passengers. Infants must be ≤ number of adults.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Done
      </button>
    </div>,
    document.body,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { updatePos(); setOpen((o) => !o); }}
        className={triggerCls}
      >
        <Users className={cn('w-4 h-4 shrink-0', iconCls)} />
        <span className="flex-1 text-left text-sm">
          {total} Passenger{total !== 1 ? 's' : ''}
        </span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', iconCls, open && 'rotate-180')} />
      </button>

      {dropdown}
    </>
  );
}
