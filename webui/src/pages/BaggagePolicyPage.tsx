import { useNavigate } from 'react-router-dom';
import { Package, Check, X, AlertTriangle, ChevronLeft, Scale, Ruler, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const CLASSES = [
  {
    name: 'Economy',
    color: 'border-border',
    badge: 'bg-muted text-muted-foreground',
    carry: '1 × 7 kg (55 × 38 × 20 cm)',
    checked: '1 × 20 kg',
    excess: 'USD 80 / extra bag',
    extra: ['Standard seat (17" wide)', 'In-flight meals included', 'USB charging port'],
  },
  {
    name: 'Premium Economy',
    color: 'border-blue-500/40',
    badge: 'bg-blue-500/15 text-blue-400',
    carry: '2 × 7 kg (55 × 38 × 20 cm)',
    checked: '1 × 25 kg',
    excess: 'USD 60 / extra bag',
    extra: ['Extra-legroom seat', 'Enhanced meals', 'Priority boarding'],
  },
  {
    name: 'Business',
    color: 'border-primary/50',
    badge: 'bg-primary/15 text-primary',
    carry: '2 × 7 kg (55 × 38 × 20 cm)',
    checked: '2 × 32 kg',
    excess: 'USD 40 / extra bag',
    extra: ['Lie-flat bed', 'Lounge access', 'Chauffeur service', 'Premium dining'],
  },
  {
    name: 'First Class',
    color: 'border-amber-500/50',
    badge: 'bg-amber-500/15 text-amber-400',
    carry: '2 × 7 kg (55 × 38 × 20 cm)',
    checked: '3 × 32 kg',
    excess: 'Complimentary',
    extra: ['Private suite', 'Onboard bar', 'Spa & shower', 'Dedicated concierge'],
  },
];

const PROHIBITED = [
  'Explosive devices and ammunition',
  'Flammable liquids (>100ml)',
  'Corrosive materials',
  'Toxic or radioactive substances',
  'Sharp objects in carry-on',
  'Firearms without prior approval',
  'Lithium batteries above 160Wh',
  'Dry ice above 2.5 kg',
];

const SPECIAL_ITEMS = [
  { item: 'Sports equipment', note: 'Must be checked; fees may apply' },
  { item: 'Musical instruments', note: 'Small instruments may be carried on' },
  { item: 'Mobility aids', note: 'Wheelchairs transported free of charge' },
  { item: 'Medical equipment', note: 'Requires advance documentation' },
  { item: 'Baby pram / stroller', note: 'One per infant, checked free' },
  { item: 'Pets in cabin', note: 'Max 7 kg including carrier; select routes only' },
  { item: 'Fragile items', note: 'Special handling available at additional cost' },
  { item: 'Liquids in carry-on', note: 'Max 100ml per container, in a 1L clear bag' },
];

export function BaggagePolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0D0D0D] via-[#1A1A2E] to-[#1B2A4A] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <button onClick={() => navigate('/help')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors mb-6 text-sm">
            <ChevronLeft className="w-4 h-4" /> Help Centre
          </button>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Package className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Baggage Policy</h1>
              <p className="text-white/60 mt-1">Allowances, fees, and special items for all cabin classes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Allowances by class */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="flex items-center gap-3 mb-8">
          <Scale className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold">Allowances by cabin class</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CLASSES.map(({ name, color, badge, carry, checked, excess, extra }) => (
            <Card key={name} className={`border-2 ${color}`}>
              <CardHeader className="pb-2">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full w-fit ${badge}`}>{name}</span>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carry-on</span>
                  </div>
                  <p className="text-sm font-medium">{carry}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checked</span>
                  </div>
                  <p className="text-sm font-medium">{checked}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Excess fee</span>
                  </div>
                  <p className="text-sm font-medium">{excess}</p>
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  {extra.map((e) => (
                    <div key={e} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-green-400 shrink-0" />
                      {e}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Size guide */}
      <section className="bg-card border-y border-border py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-8">
            <Ruler className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-bold">Size & weight guide</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Carry-on bag</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Max dimensions</span>
                    <span className="font-semibold">55 × 38 × 20 cm</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Max weight</span>
                    <span className="font-semibold">7 kg</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Liquids</span>
                    <span className="font-semibold">≤ 100ml per container</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Laptops / tablets</span>
                    <span className="font-semibold">Permitted</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Checked baggage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Max dimensions (sum)</span>
                    <span className="font-semibold">≤ 158 cm</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Economy max weight</span>
                    <span className="font-semibold">20 kg per bag</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Business max weight</span>
                    <span className="font-semibold">32 kg per bag</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Excess weight fee</span>
                    <span className="font-semibold">USD 15 / kg</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Special items */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold mb-8">Special items</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {SPECIAL_ITEMS.map(({ item, note }) => (
            <div key={item} className="flex items-start gap-3 p-4 border border-border rounded-xl hover:bg-muted/20 transition-colors">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{item}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Prohibited */}
      <section className="bg-red-500/5 border-y border-red-500/20 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-8">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-2xl font-bold">Prohibited items</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {PROHIBITED.map((item) => (
              <div key={item} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Attempting to carry prohibited items may result in confiscation, fines, or criminal prosecution.
            When in doubt, always check with us before packing.
          </p>
        </div>
      </section>
    </div>
  );
}
