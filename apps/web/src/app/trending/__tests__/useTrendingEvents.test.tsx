import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FilterSortState } from "@/components/FilterSort";
import type { Prediction } from "@/features/trending/trendingModel";
import { useTrendingEvents } from "../hooks/useTrendingEvents";

type WrapperProps = {
  predictions: Prediction[];
  filters: FilterSortState;
};

function TestComponent({ predictions, filters }: WrapperProps) {
  const { visibleEvents, hasMore, totalEventsCount } = useTrendingEvents(predictions, filters);

  return (
    <div>
      <span data-testid="visible-count">{visibleEvents.length}</span>
      <span data-testid="total-count">{totalEventsCount}</span>
      <span data-testid="has-more">{String(hasMore)}</span>
    </div>
  );
}

function buildPrediction(id: number): Prediction {
  return {
    id,
    title: `Event ${id}`,
    description: `Description ${id}`,
    min_stake: 1,
    category: "sports",
  };
}

const baseFilters: FilterSortState = {
  category: null,
  sortBy: "trending",
  status: null,
};

describe("useTrendingEvents", () => {
  it("limits visible events to initial page size and reports hasMore", () => {
    const predictions = Array.from({ length: 20 }, (_, i) => buildPrediction(i + 1));

    render(<TestComponent predictions={predictions} filters={baseFilters} />);

    expect(screen.getByTestId("visible-count").textContent).toBe("12");
    expect(screen.getByTestId("total-count").textContent).toBe("20");
    expect(screen.getByTestId("has-more").textContent).toBe("true");
  });

  it("shows all events when total count is below page size", () => {
    const predictions = Array.from({ length: 5 }, (_, i) => buildPrediction(i + 1));

    render(<TestComponent predictions={predictions} filters={baseFilters} />);

    expect(screen.getByTestId("visible-count").textContent).toBe("5");
    expect(screen.getByTestId("total-count").textContent).toBe("5");
    expect(screen.getByTestId("has-more").textContent).toBe("false");
  });
});
