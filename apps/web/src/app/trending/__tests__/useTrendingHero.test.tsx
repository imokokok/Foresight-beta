import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FilterSortState } from "@/components/FilterSort";
import type { TrendingCategory, TrendingEvent } from "@/features/trending/trendingModel";
import { useTrendingHero } from "../hooks/useTrendingHero";

type HeroTestProps = {
  events: TrendingEvent[];
  categories: TrendingCategory[];
};

function HeroTestComponent({ events, categories }: HeroTestProps) {
  const filters: FilterSortState = {
    category: null,
    sortBy: "trending",
    status: null,
  };

  const { activeTitle, heroSlideLength, currentHeroIndex, handleNextHero, handlePrevHero } =
    useTrendingHero(
      events,
      categories,
      () => filters,
      (key: string) => key,
      (key: string) => key
    );

  return (
    <div>
      <span data-testid="hero-title">{activeTitle}</span>
      <span data-testid="hero-length">{heroSlideLength}</span>
      <span data-testid="hero-index">{currentHeroIndex}</span>
      <button data-testid="hero-next" onClick={handleNextHero}>
        next
      </button>
      <button data-testid="hero-prev" onClick={handlePrevHero}>
        prev
      </button>
    </div>
  );
}

function buildEvent(id: number, tag: string, followers: number): TrendingEvent {
  return {
    id,
    title: `Hero ${id}`,
    description: `Description ${id}`,
    insured: "",
    minInvestment: "",
    tag,
    category: tag,
    image: "",
    followers_count: followers,
    type: "default",
    outcomes: [],
  };
}

describe("useTrendingHero", () => {
  it("builds hero slides from events and exposes active title", () => {
    const events: TrendingEvent[] = [
      buildEvent(1, "sports", 10),
      buildEvent(2, "sports", 20),
      buildEvent(3, "tech", 5),
    ];

    const categories: TrendingCategory[] = [
      { name: "sports", icon: "", color: "" },
      { name: "tech", icon: "", color: "" },
    ];

    render(<HeroTestComponent events={events} categories={categories} />);

    expect(screen.getByTestId("hero-length").textContent).toBe("2");
    expect(screen.getByTestId("hero-title").textContent).toBe("Hero 2");
  });

  it("keeps hero index within bounds when navigating", () => {
    const events: TrendingEvent[] = [
      buildEvent(1, "sports", 10),
      buildEvent(2, "sports", 20),
      buildEvent(3, "tech", 5),
    ];

    const categories: TrendingCategory[] = [
      { name: "sports", icon: "", color: "" },
      { name: "tech", icon: "", color: "" },
    ];

    render(<HeroTestComponent events={events} categories={categories} />);

    const total = Number(screen.getByTestId("hero-length").textContent || "0");
    const nextButton = screen.getByTestId("hero-next");
    const prevButton = screen.getByTestId("hero-prev");

    for (let i = 0; i < total + 3; i += 1) {
      fireEvent.click(nextButton);
    }

    const forwardIndex = Number(screen.getByTestId("hero-index").textContent || "-1");
    expect(forwardIndex).toBeGreaterThanOrEqual(0);
    expect(forwardIndex).toBeLessThan(total);

    for (let i = 0; i < total + 3; i += 1) {
      fireEvent.click(prevButton);
    }

    const backwardIndex = Number(screen.getByTestId("hero-index").textContent || "-1");
    expect(backwardIndex).toBeGreaterThanOrEqual(0);
    expect(backwardIndex).toBeLessThan(total);
  });
});
