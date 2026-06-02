import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, ChevronDown } from 'lucide-react';
import { searchAirports, type Airport } from '../lib/airports';
import { cn } from '../lib/utils';

export interface AirportSelectProps {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  /** Use "dark" when the component sits on a dark/image hero background */
  variant?: 'default' | 'dark';
}

interface DropdownPos { top: number; left: number; width: number }

export function AirportSelect({
  value,
  onChange,
  placeholder = 'Search airport…',
  label,
  className,
  variant = 'default',
}: AirportSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Compute dropdown anchor from trigger bounding box
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  // Reposition on scroll / resize while the dropdown is open
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

  // Close when clicking outside both trigger and portal dropdown
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Live search
  useEffect(() => {
    setResults(query.length > 0 ? searchAirports(query) : []);
  }, [query]);

  function openDropdown() {
    updatePos();
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(airport: Airport) {
    onChange(airport.iata);
    setQuery('');
    setOpen(false);
  }

  // ── Trigger appearance ────────────────────────────────────────────────────

  const dark = variant === 'dark';

  const triggerCls = cn(
    'flex items-center gap-2.5 w-full rounded-xl px-4 py-3 cursor-pointer transition-all select-none',
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

  const iconCls  = dark ? 'text-white/50' : 'text-muted-foreground';
  const valueCls = dark ? 'text-white' : 'text-foreground';
  const phCls    = dark ? 'text-white/40' : 'text-muted-foreground';
  const labelCls = dark
    ? 'block text-xs text-white/60 mb-1.5 uppercase tracking-wider font-medium'
    : 'block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium';

  // ── Portal-rendered dropdown (escapes overflow + stacking contexts) ────────

  const dropdown = open && createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Inline search input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value ? `Change: ${value}` : placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {results.length > 0 ? (
        <ul className="py-1 max-h-60 overflow-y-auto">
          {results.map((airport) => (
            <li key={airport.iata}>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(airport); }}
              >
                <span className="font-mono font-bold text-primary text-sm w-10 shrink-0">{airport.iata}</span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{airport.city}</p>
                  <p className="text-xs text-muted-foreground truncate">{airport.name} · {airport.country}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : query.length > 0 ? (
        <p className="px-3 py-5 text-sm text-muted-foreground text-center">No airports found for "{query}"</p>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">Type to search by city, airport or IATA code</p>
      )}
    </div>,
    document.body,
  );

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      {label && <label className={labelCls}>{label}</label>}

      <div className={triggerCls} onClick={openDropdown}>
        <MapPin className={cn('w-4 h-4 shrink-0', iconCls)} />
        <div className="flex-1 min-w-0 overflow-hidden">
          {value ? (
            <p className={cn('text-sm font-mono font-semibold truncate', valueCls)}>{value}</p>
          ) : (
            <p className={cn('text-sm truncate', phCls)}>{placeholder}</p>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', iconCls, open && 'rotate-180')} />
      </div>

      {dropdown}
    </div>
  );
}
