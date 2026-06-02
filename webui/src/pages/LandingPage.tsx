import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plane, ArrowLeftRight, Calendar, ChevronRight,
  Shield, Clock, Star, Award, Globe, HeadphonesIcon,
  Wifi, Utensils, Gift, MapPin
} from 'lucide-react';
import { AirportSelect } from '../components/AirportSelect';
import { PassengersSelector, type PassengerCounts } from '../components/PassengersSelector';
import { POPULAR_DESTINATIONS, findAirport } from '../lib/airports';
import { basePrice, formatPrice } from '../lib/pricing';
import { useAuthStore } from '../store/auth.store';

type TripType = 'one-way' | 'return' | 'multi-city';
type CabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

const CABIN_LABELS: Record<CabinClass, string> = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First Class',
};

export function LandingPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.accessToken);

  const [tab, setTab] = useState<'book' | 'manage' | 'checkin'>('book');
  const [tripType, setTripType] = useState<TripType>('return');
  const [origin, setOrigin] = useState('SIN');
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [cabinClass, setCabinClass] = useState<CabinClass>('ECONOMY');
  const [passengers, setPassengers] = useState<PassengerCounts>({ adults: 1, children: 0, infants: 0 });
  const [bookingRef, setBookingRef] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !destination || !departDate) return;
    const params = new URLSearchParams({
      origin,
      destination,
      departDate,
      returnDate: tripType === 'return' ? returnDate : '',
      tripType,
      cabin: cabinClass,
      adults: String(passengers.adults),
      children: String(passengers.children),
      infants: String(passengers.infants),
    });
    navigate(`/search?${params.toString()}`);
  }

  function swapAirports() {
    setOrigin(destination);
    setDestination(origin);
  }

  const today = new Date().toISOString().split('T')[0];
  const inputBase = 'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15 transition-all text-sm';

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1800&q=85')" }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A]/40 to-transparent" />

        {/* Hero content */}
        <div className="relative flex-1 flex flex-col justify-end max-w-7xl mx-auto w-full px-4 pb-0">
          <div className="mb-8 mt-24">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-xs mb-5">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              World's Best Airline 2024 · Skytrax
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-4 leading-tight">
              Where would<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-200">
                you like to go?
              </span>
            </h1>
            <p className="text-white/60 text-lg max-w-xl">
              Discover the world with AeroLink. Premium flights to 180+ destinations, every class, every day.
            </p>
          </div>

          {/* ── SEARCH WIDGET ────────────────────────────────────────── */}
          {/* NOTE: no overflow-hidden — it would clip the airport dropdown portal */}
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
            {/* Tabs — overflow-hidden only on this row so corners clip correctly */}
            <div className="flex border-b border-white/10 rounded-t-3xl overflow-hidden">
              {(['book', 'manage', 'checkin'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-6 py-4 text-sm font-medium capitalize transition-all ${
                    tab === t
                      ? 'text-white border-b-2 border-primary bg-white/5'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {t === 'book' ? 'Book' : t === 'manage' ? 'Manage' : 'Check-in'}
                </button>
              ))}
            </div>

            {/* Book tab */}
            {tab === 'book' && (
              <div className="p-6">
                {/* Trip type */}
                <div className="flex gap-1 mb-5">
                  {([
                    ['one-way', 'One way'],
                    ['return', 'Return'],
                    ['multi-city', 'Multi-city'],
                  ] as const).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => setTripType(type)}
                      type="button"
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        tripType === type
                          ? 'bg-primary text-white'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  {/* From / To row */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                    <AirportSelect
                      label="From"
                      value={origin}
                      onChange={setOrigin}
                      placeholder="City or airport"
                      variant="dark"
                    />

                    <button
                      type="button"
                      onClick={swapAirports}
                      className="flex-shrink-0 size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all hover:rotate-180 duration-300 self-end mb-0.5"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>

                    <AirportSelect
                      label="To"
                      value={destination}
                      onChange={setDestination}
                      placeholder="City or airport"
                      variant="dark"
                    />
                  </div>

                  {/* Dates + Class + Passengers */}
                  <div className={`grid gap-3 ${tripType === 'return' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5 font-medium">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Departure
                      </label>
                      <input
                        type="date"
                        min={today}
                        value={departDate}
                        onChange={(e) => setDepartDate(e.target.value)}
                        required
                        className={inputBase + ' [color-scheme:dark]'}
                      />
                    </div>

                    {tripType === 'return' && (
                      <div>
                        <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5 font-medium">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Return
                        </label>
                        <input
                          type="date"
                          min={departDate || today}
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                          className={inputBase + ' [color-scheme:dark]'}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5 font-medium">Cabin class</label>
                      <select
                        value={cabinClass}
                        onChange={(e) => setCabinClass(e.target.value as CabinClass)}
                        className={inputBase}
                      >
                        {(Object.entries(CABIN_LABELS) as [CabinClass, string][]).map(([k, v]) => (
                          <option key={k} value={k} className="bg-[#1A1A2E] text-white">{v}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5 font-medium">Passengers</label>
                      <PassengersSelector value={passengers} onChange={setPassengers} variant="dark" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-100 shadow-lg shadow-primary/30"
                    >
                      <Plane className="w-4 h-4" />
                      Search flights
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Manage tab */}
            {tab === 'manage' && (
              <div className="p-6">
                <p className="text-white/60 text-sm mb-4">Retrieve your booking to manage your reservation, add services, or request changes.</p>
                <div className="flex gap-3">
                  <input
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    placeholder="Booking reference (e.g. ARL-12345)"
                    className={inputBase + ' flex-1'}
                  />
                  <button
                    onClick={() => {
                      if (!token) navigate('/login?redirect=/bookings');
                      else navigate('/bookings');
                    }}
                    className="bg-primary text-white px-6 py-3 rounded-xl font-medium text-sm whitespace-nowrap"
                  >
                    Retrieve
                  </button>
                </div>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => navigate(token ? '/bookings' : '/login?redirect=/bookings')}
                    className="text-white/60 hover:text-white text-sm underline">
                    View all bookings
                  </button>
                  <span className="text-white/20">|</span>
                  <button onClick={() => navigate(token ? '/checkin' : '/login?redirect=/checkin')}
                    className="text-white/60 hover:text-white text-sm underline">
                    Online check-in
                  </button>
                </div>
              </div>
            )}

            {/* Check-in tab */}
            {tab === 'checkin' && (
              <div className="p-6">
                <p className="text-white/60 text-sm mb-4">
                  Online check-in opens 48 hours before departure and closes 90 minutes before.
                </p>
                <button
                  onClick={() => navigate(token ? '/checkin' : '/login?redirect=/checkin')}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  Proceed to check-in
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="relative flex justify-center py-6">
          <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent animate-pulse" />
        </div>
      </section>

      {/* ── POPULAR DESTINATIONS ──────────────────────────────────────── */}
      <section id="destinations" className="max-w-7xl mx-auto w-full px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Discover</p>
            <h2 className="text-3xl font-bold">Popular destinations</h2>
            <p className="text-muted-foreground mt-1">Handpicked routes from Singapore</p>
          </div>
          <button
            onClick={() => navigate('/search?origin=SIN&destination=&departDate=&tripType=one-way&cabin=ECONOMY&adults=1&children=0&infants=0')}
            className="text-sm text-primary hover:underline hidden md:block"
          >
            View all destinations →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {POPULAR_DESTINATIONS.map(({ iata, tag, image }) => {
            const dest = findAirport(iata);
            const price = dest ? basePrice('SIN', iata) : null;
            return (
              <div
                key={iata}
                onClick={() => navigate(`/search?origin=SIN&destination=${iata}&departDate=${new Date(Date.now() + 86400_000 * 7).toISOString().split('T')[0]}&tripType=return&cabin=ECONOMY&adults=1&children=0&infants=0`)}
                className="group cursor-pointer rounded-2xl overflow-hidden relative aspect-[4/5] md:aspect-[3/4] shadow-md hover:shadow-xl transition-all hover:-translate-y-1 duration-300"
              >
                <img
                  src={image}
                  alt={tag}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white font-bold text-lg leading-tight">{tag}</p>
                  <p className="text-white/60 text-xs font-mono">{iata} · {dest?.country}</p>
                  {price && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-primary/80 backdrop-blur-sm rounded-full px-3 py-1">
                      <span className="text-white text-xs font-semibold">From {formatPrice(price)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WHY AEROLINK ─────────────────────────────────────────────── */}
      <section className="bg-card border-y border-border py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Why AeroLink</p>
            <h2 className="text-3xl font-bold">A premium experience, end to end</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Wifi, title: 'In-flight Connectivity', desc: 'High-speed Wi-Fi across all cabin classes' },
              { icon: Utensils, title: 'Gourmet Dining', desc: 'Chef-curated menus with regional cuisine' },
              { icon: Gift, title: 'Loyalty Rewards', desc: 'Earn miles on every flight, redeem anywhere' },
              { icon: HeadphonesIcon, title: '24/7 Support', desc: 'Round-the-clock assistance in 30 languages' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXPERIENCE CLASSES ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Cabin classes</p>
          <h2 className="text-3xl font-bold">Travel your way</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: 'Economy',
              image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80',
              desc: 'Comfortable seating with great in-flight entertainment and meals.',
              color: 'from-slate-900/80',
            },
            {
              name: 'Premium Economy',
              image: 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=600&q=80',
              desc: 'Extra legroom, enhanced dining, and priority boarding.',
              color: 'from-blue-900/80',
            },
            {
              name: 'Business',
              image: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=600&q=80',
              desc: 'Lie-flat beds, lounge access, and personalised service.',
              color: 'from-[#1B2A4A]/90',
            },
            {
              name: 'First Class',
              image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
              desc: 'Private suites, chauffeur service, and the finest dining at altitude.',
              color: 'from-amber-900/80',
            },
          ].map(({ name, image, desc, color }) => (
            <div key={name} className="group relative rounded-2xl overflow-hidden cursor-pointer aspect-[3/4]"
              onClick={() => navigate('/help/baggage')}>
              <img src={image} alt={name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
              <div className={`absolute inset-0 bg-gradient-to-t ${color} to-transparent`} />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-white font-bold text-xl">{name}</p>
                <p className="text-white/70 text-xs mt-1 leading-relaxed">{desc}</p>
                <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white transition-colors">
                  <span>Explore</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRACK YOUR FLIGHT CTA ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D0D0D] py-16">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=1400&q=70')",
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-blue-400 font-semibold uppercase tracking-widest">Live Flight Tracker</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Track any flight, anywhere</h2>
            <p className="text-white/60">
              Real-time positions, altitude, speed, and route visualisation for all AeroLink flights on an interactive world map.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => navigate('/track')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold flex items-center gap-3 transition-all hover:scale-[1.02] shadow-lg shadow-blue-900/40"
            >
              <MapPin className="w-5 h-5" />
              Open Flight Tracker
            </button>
          </div>
        </div>
      </section>

      {/* ── TRUST SIGNALS ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto w-full px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: Award, value: '180+', label: 'Destinations' },
            { icon: Globe, value: '94%', label: 'On-time rate' },
            { icon: Shield, value: 'PCI DSS', label: 'Secure payments' },
            { icon: Clock, value: '24/7', label: 'Customer support' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon className="w-6 h-6 text-primary" />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AUTH CTA ──────────────────────────────────────────────────── */}
      {!token && (
        <section className="bg-primary text-primary-foreground py-12">
          <div className="max-w-2xl mx-auto text-center px-4">
            <h2 className="text-2xl font-bold mb-2">Ready to take off?</h2>
            <p className="opacity-80 mb-6 text-sm">Join millions of travellers who book smarter with AeroLink.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/register')}
                className="bg-white text-primary px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors">
                Create free account
              </button>
              <button onClick={() => navigate('/login')}
                className="bg-white/10 text-white border border-white/30 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors">
                Sign in
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
