import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, ChevronDown,
  Ticket, Package, CheckSquare, CreditCard,
  Plane, UserCircle, Phone, Mail, MessageSquare,
  ShieldCheck, Clock
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

const TOPICS = [
  {
    icon: Ticket,
    title: 'Bookings',
    color: 'text-blue-400 bg-blue-500/10',
    items: [
      'How do I book a flight?',
      'Can I hold a booking without paying?',
      'What is the ticket validity period?',
      'How do I change my travel dates?',
      'Can I cancel my booking?',
    ],
  },
  {
    icon: Package,
    title: 'Baggage',
    color: 'text-amber-400 bg-amber-500/10',
    items: [
      'What is my baggage allowance?',
      'How do I add extra baggage?',
      'What items are prohibited?',
      'How do I track my baggage?',
      'What happens if my bag is lost?',
    ],
    link: '/help/baggage',
  },
  {
    icon: CheckSquare,
    title: 'Check-in',
    color: 'text-green-400 bg-green-500/10',
    items: [
      'When does online check-in open?',
      'What documents do I need at the airport?',
      'How do I get my boarding pass?',
      'Can I choose my seat?',
      'What if I miss online check-in?',
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments',
    color: 'text-primary bg-primary/10',
    items: [
      'What payment methods are accepted?',
      'Is my payment secure?',
      'When is my credit card charged?',
      'How do refunds work?',
      'Can I pay in instalments?',
    ],
  },
  {
    icon: Plane,
    title: 'Flights',
    color: 'text-cyan-400 bg-cyan-500/10',
    items: [
      'How do I find available flights?',
      'What cabin classes are available?',
      'What is included in my fare?',
      'Are meals included?',
      'Do you fly to my destination?',
    ],
  },
  {
    icon: UserCircle,
    title: 'Account',
    color: 'text-purple-400 bg-purple-500/10',
    items: [
      'How do I create an account?',
      'How do I reset my password?',
      'How do I update my profile?',
      'Can I merge accounts?',
      'How do I delete my account?',
    ],
  },
];

const FAQS = [
  {
    q: 'How early should I arrive at the airport?',
    a: 'We recommend arriving at least 3 hours before international flights and 2 hours before domestic flights. Check-in typically closes 60 minutes before departure.',
  },
  {
    q: 'What documents do I need to travel?',
    a: 'You will need a valid passport (with at least 6 months validity), and any required visas for your destination. Some routes may also require travel insurance.',
  },
  {
    q: 'Can I bring my pet on board?',
    a: 'Small pets may be allowed in the cabin on select routes. Service animals are permitted with advance notification. Please contact us 48 hours before travel.',
  },
  {
    q: 'What is the in-flight entertainment like?',
    a: 'All aircraft are equipped with personal screens featuring 1,000+ channels of movies, TV shows, music, and games. Wi-Fi is available on most routes.',
  },
  {
    q: 'How can I request special meals?',
    a: 'Special meals (vegetarian, vegan, gluten-free, kosher, halal, and more) can be requested up to 24 hours before departure through your booking management page.',
  },
  {
    q: 'What happens if my flight is delayed or cancelled?',
    a: 'You will be notified via email and SMS. We will rebook you on the next available flight at no charge. You may also be entitled to meals and accommodation depending on the delay duration.',
  },
];

export function HelpCenterPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(
    (f) =>
      !search ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0D0D0D] via-[#1A1A2E] to-[#1B2A4A] py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-white mb-3">How can we help you?</h1>
          <p className="text-white/60 mb-8">Search our help centre or browse topics below</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers…"
              className="w-full bg-white/10 border border-white/20 rounded-2xl pl-12 pr-5 py-4 text-white placeholder-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Topics grid */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold mb-8">Browse topics</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOPICS.map(({ icon: Icon, title, color, items, link }) => (
            <Card key={title} className="hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => link ? navigate(link) : undefined}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  {link && <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />}
                </div>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card border-y border-border py-14">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-2">Frequently asked questions</h2>
          <p className="text-muted-foreground mb-8">Quick answers to common queries</p>

          <div className="space-y-2">
            {filteredFaqs.map((faq, idx) => (
              <div key={idx} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold mb-2 text-center">Still need help?</h2>
        <p className="text-muted-foreground text-center mb-10">Our team is available 24/7 across multiple channels</p>

        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            {
              icon: Phone,
              title: 'Phone',
              desc: '+65 6591 8888',
              sub: 'Available 24/7',
              color: 'text-green-400 bg-green-500/10',
            },
            {
              icon: Mail,
              title: 'Email',
              desc: 'support@aerolink.app',
              sub: 'Response within 24h',
              color: 'text-blue-400 bg-blue-500/10',
            },
            {
              icon: MessageSquare,
              title: 'Live Chat',
              desc: 'Start a conversation',
              sub: 'Avg wait: 2 minutes',
              color: 'text-primary bg-primary/10',
            },
          ].map(({ icon: Icon, title, desc, sub, color }) => (
            <Card key={title} className="text-center hover:border-primary/40 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className={`size-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-foreground">{desc}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />{sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Security note */}
      <section className="bg-primary/5 border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            AeroLink uses 256-bit SSL encryption and PCI-DSS compliant payment processing.
            We will never ask for your password via email or phone.
          </p>
        </div>
      </section>
    </div>
  );
}
