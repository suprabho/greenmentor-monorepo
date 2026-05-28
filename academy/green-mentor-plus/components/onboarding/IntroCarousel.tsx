"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { IntroCard } from "@/lib/data/intro-cards";
import { cn } from "@/lib/utils/cn";

interface IntroCarouselProps {
  cards: IntroCard[];
}

export function IntroCarousel({ cards }: IntroCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // Whether the track actually overflows in each direction. On desktop the
  // cards lay out as a 3-up grid with nothing to scroll, so both stay false
  // and the arrows hide.
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Keep dot indicator in sync with manual swipes via a scroll listener.
  // Programmatic dot taps update activeIndex directly inside scrollTo,
  // since scrollTo({behavior:'instant'}) doesn't always dispatch a scroll
  // event in time.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActiveIndex(bestIdx);

      // 1px tolerance absorbs sub-pixel rounding at the scroll extremes.
      setCanScrollPrev(track.scrollLeft > 1);
      setCanScrollNext(
        track.scrollLeft + track.clientWidth < track.scrollWidth - 1,
      );
    };

    update();
    track.addEventListener("scroll", update, { passive: true });
    // Recompute when the layout changes (e.g. mobile carousel ⇄ desktop grid).
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [cards.length]);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    const target = cardRefs.current[index];
    if (!track || !target) return;
    // Compute the snap-center position the browser would land on after
    // a natural swipe, then jump there. Doing the math ourselves avoids
    // the snap engine fighting our programmatic scroll mid-flight.
    const cardCenter = target.offsetLeft + target.offsetWidth / 2;
    const left = Math.max(0, cardCenter - track.clientWidth / 2);
    track.style.scrollSnapType = "none";
    track.scrollTo({ left, behavior: "instant" });
    setActiveIndex(index);
    window.requestAnimationFrame(() => {
      track.style.removeProperty("scroll-snap-type");
    });
  }, []);

  const goPrev = () => scrollTo(Math.max(0, activeIndex - 1));
  const goNext = () =>
    scrollTo(Math.min(cards.length - 1, activeIndex + 1));

  return (
    <div className="relative">
      {/* Desktop arrows — hidden on mobile, where swipe is the gesture */}
      <button
        type="button"
        aria-label="Previous card"
        onClick={goPrev}
        disabled={!canScrollPrev}
        className={cn(
          "absolute top-1/2 -left-4 z-10 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-3 shadow-soft transition-opacity",
          "md:flex",
          !canScrollPrev
            ? "pointer-events-none opacity-0"
            : "hover:border-green-700",
        )}
      >
        <CaretLeft size={18} weight="bold" className="text-ink" />
      </button>
      <button
        type="button"
        aria-label="Next card"
        onClick={goNext}
        disabled={!canScrollNext}
        className={cn(
          "absolute top-1/2 -right-4 z-10 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-3 shadow-soft transition-opacity",
          "md:flex",
          !canScrollNext
            ? "pointer-events-none opacity-0"
            : "hover:border-green-700",
        )}
      >
        <CaretRight size={18} weight="bold" className="text-ink" />
      </button>

      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Green Mentor intro"
        className={cn(
          // Mobile: horizontal snap-scroll carousel
          "-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2",
          // Hide scrollbar
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Desktop: switch to a 3-up grid, no scroll
          "md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0",
        )}
      >
        {cards.map((card, i) => {
          const Icon = card.icon;
          const isActive = i === activeIndex;
          return (
            <div
              key={card.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${cards.length}`}
              className={cn(
                // Mobile: each card takes ~78% of viewport so more of the
                // next card peeks in to telegraph "swipeable". `min-w-0`
                // overrides the flex default (min-content) so the card
                // actually honors basis instead of growing to fit content.
                "min-w-0 basis-[78%] shrink-0 snap-center",
                "md:basis-auto",
              )}
            >
              <div
                className={cn(
                  "flex h-full flex-col rounded-[20px] border bg-white/20 backdrop:backdrop-blur-2xl p-7 transition-[border-color,box-shadow] duration-200",
                  isActive
                    ? "border-green-500 shadow-lift md:shadow-soft"
                    : "border-gray-200/20",
                )}
              >
                <div className="grid size-12 place-items-center rounded-full bg-green-900/20">
                  <Icon
                    size={24}
                    weight="fill"
                    className="text-green-500"
                    aria-hidden
                  />
                </div>
                <p className="gm-eyebrow mt-6 text-green-300">{card.eyebrow}</p>
                <h2 className="font-display mt-3 text-[24px] leading-tight tracking-[-0.02em] text-white">
                  {card.title}
                </h2>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dots — primary affordance on mobile, hidden on desktop where the
          grid shows all cards at once */}
      <div
        role="tablist"
        aria-label="Carousel pagination"
        className="mt-6 flex items-center justify-center gap-2 md:hidden"
      >
        {cards.map((card, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Go to slide ${i + 1}: ${card.eyebrow}`}
              onClick={() => scrollTo(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                isActive ? "w-8 bg-green-700" : "w-2 bg-gray-300",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
