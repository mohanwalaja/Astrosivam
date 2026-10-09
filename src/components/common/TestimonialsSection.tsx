import React, { useState, useRef, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote, MapPin, CheckCircle, Sparkles } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  location: string;
  service: string;
  rating: number;
  date: string;
  feedback: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Rajesh & Priya Sharma',
    location: 'Chennai, Tamil Nadu, India',
    service: 'Marriage Compatibility (Porutham)',
    rating: 5,
    date: 'February 2026',
    feedback: 'The 10 Poruthams matching report was so detailed and respectful. The explanations on Nakshatra alignment and Dasa Sandhi gave our families total peace of mind. Truly authentic traditional guidance from our revered priest team.'
  },
  {
    id: '2',
    name: 'Kavita Maharaj',
    location: 'Sydney, Australia',
    service: 'Janma Jathagam (Birth Horoscope)',
    rating: 5,
    date: 'January 2026',
    feedback: 'Received my full Rasi and Navamsa chart with complete Vimshottari Dasa timeline within hours of admin approval. Clear, uplifting, and devoid of unnecessary fear. Highly recommended!'
  },
  {
    id: '3',
    name: 'Amit & Deepa Prasad',
    location: 'Auckland, New Zealand',
    service: 'Baby Naming (Namakaranam)',
    rating: 5,
    date: 'February 2026',
    feedback: 'We found the most beautiful Vedic name for our baby girl starting with the auspicious nakshatra syllables provided in the report. The printable birth certificate is framed in our nursery.'
  },
  {
    id: '6',
    name: 'Ganesh Iyer',
    location: 'Suva, Fiji',
    service: 'Subha Muhurtham (Auspicious Dates)',
    rating: 5,
    date: 'February 2026',
    feedback: 'The 6-month muhurtham calendar made fixing our Griha Pravesam date so easy. Every auspicious window came with Nalla Neram timings and Rahu Kalam warnings, verified by the priest team. Excellent authentic Panchangam work.'
  },
  {
    id: '4',
    name: 'Sunil Kumar',
    location: 'Bengaluru, Karnataka, India',
    service: 'Janma Jathagam',
    rating: 5,
    date: 'January 2026',
    feedback: 'Very easy to order and pay using Google Pay UPI QR. The report arrived directly in my email with high-resolution chart diagrams in both English and Tamil. Excellent Vedic analysis.'
  },
  {
    id: '5',
    name: 'Meena Pillay',
    location: 'Vancouver, Canada',
    service: 'Janma Jathagam & Dasa Analysis',
    rating: 5,
    date: 'December 2025',
    feedback: 'The precision of the Lahiri calculations matched my family priest in Tamil Nadu exactly. The clear transit predictions and planet strength indicators are wonderful.'
  }
];

export const TestimonialsSection: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cards = container.querySelectorAll<HTMLElement>('.testimonial-slider-item');
    if (!cards || cards.length === 0) return;

    const targetCard = cards[index];
    if (targetCard) {
      const scrollPosition = targetCard.offsetLeft - container.offsetLeft;
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
    }
  }, []);

  const handleNext = useCallback(() => {
    const nextIdx = (currentIndex + 1) % TESTIMONIALS.length;
    scrollToIndex(nextIdx);
  }, [currentIndex, scrollToIndex]);

  const handlePrev = useCallback(() => {
    const prevIdx = (currentIndex - 1 + TESTIMONIALS.length) % TESTIMONIALS.length;
    scrollToIndex(prevIdx);
  }, [currentIndex, scrollToIndex]);

  // Track active slide on manual touch/scroll
  const handleScrollEvent = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cards = container.querySelectorAll<HTMLElement>('.testimonial-slider-item');
    if (!cards || cards.length === 0) return;

    const scrollLeft = container.scrollLeft;
    let closestIndex = 0;
    let minDistance = Infinity;

    cards.forEach((card, idx) => {
      const distance = Math.abs(card.offsetLeft - container.offsetLeft - scrollLeft);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    setCurrentIndex(closestIndex);
  };

  const testimonialThemes = [
    {
      cardClass: 'testimonial-card testimonial-card-gold',
      tagClass: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
      pinColor: 'text-amber-400',
      quoteColor: 'text-amber-400/35',
      avatarBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      cardClass: 'testimonial-card testimonial-card-purple',
      tagClass: 'text-purple-300 bg-purple-500/15 border-purple-500/30',
      pinColor: 'text-purple-400',
      quoteColor: 'text-purple-400/35',
      avatarBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
    {
      cardClass: 'testimonial-card testimonial-card-rose',
      tagClass: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
      pinColor: 'text-rose-400',
      quoteColor: 'text-rose-400/35',
      avatarBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
    {
      cardClass: 'testimonial-card testimonial-card-emerald',
      tagClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
      pinColor: 'text-emerald-400',
      quoteColor: 'text-emerald-400/35',
      avatarBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      cardClass: 'testimonial-card testimonial-card-sapphire',
      tagClass: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
      pinColor: 'text-sky-400',
      quoteColor: 'text-sky-400/35',
      avatarBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    },
  ];

  return (
    <section className="space-y-6 select-none">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="eyebrow">
            <Sparkles className="h-4 w-4" />
            <span>Reviews</span>
          </div>
          <h2 className="display-serif mt-3 text-3xl font-bold text-[#fffdfa] sm:text-4xl">
            What readers say
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-300 sm:text-base">
            Experiences shared by customers who ordered ASTRO SIVAM reports.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handlePrev}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-amber-500/30 bg-[#16122d] text-amber-300 shadow-sm transition-colors hover:border-amber-400 hover:text-amber-200"
            aria-label="Previous review"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNext}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-amber-500/30 bg-[#16122d] text-amber-300 shadow-sm transition-colors hover:border-amber-400 hover:text-amber-200"
            aria-label="Next review"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Slider Track */}
      <div
        ref={scrollRef}
        onScroll={handleScrollEvent}
        className="testimonial-scroll flex gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar focus:outline-none w-full max-w-full"
        tabIndex={0}
      >
        {TESTIMONIALS.map((t, idx) => {
          const theme = testimonialThemes[idx % testimonialThemes.length];

          return (
            <div
              key={t.id}
              className={`testimonial-slider-item ${theme.cardClass} w-[88vw] max-w-[380px] sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] sm:min-w-[340px] shrink-0 snap-start flex flex-col justify-between space-y-4`}
            >
              <div className="space-y-3.5 relative z-10">
                {/* Star Rating & Quote Icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Quote className={`w-7 h-7 ${theme.quoteColor}`} />
                </div>

                {/* Service Tag */}
                <div className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${theme.tagClass}`}>
                  {t.service}
                </div>

                {/* Feedback text */}
                <p className="text-[15px] font-normal italic leading-7 text-slate-200">
                  &ldquo;{t.feedback}&rdquo;
                </p>
              </div>

              {/* Author info */}
              <div className="pt-3.5 border-t border-white/10 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold shadow-sm ${theme.avatarBg}`}>
                    {t.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-[#fffdfa]">
                      <span>{t.name}</span>
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    </h4>
                    <div className="mt-1 flex items-start gap-1 text-[13px] leading-5 text-slate-300">
                      <MapPin className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.pinColor}`} />
                      <span>{t.location}</span>
                    </div>
                  </div>
                </div>
                <span className="hidden shrink-0 text-xs font-medium text-slate-400 sm:inline">{t.date}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slider Progress Indicator Dots */}
      <div className="flex items-center justify-center gap-2 pt-2">
        {TESTIMONIALS.map((_, dotIdx) => (
          <button
            key={dotIdx}
            onClick={() => scrollToIndex(dotIdx)}
            className={`h-2 rounded-full transition-all cursor-pointer ${
              currentIndex === dotIdx
                ? 'w-7 bg-amber-400 shadow-[0_0_8px_rgba(245,180,80,0.5)]'
                : 'w-2 bg-slate-600/50 hover:bg-slate-500'
            }`}
            aria-label={`Jump to slide ${dotIdx + 1}`}
          />
        ))}
      </div>
    </section>
  );
};
