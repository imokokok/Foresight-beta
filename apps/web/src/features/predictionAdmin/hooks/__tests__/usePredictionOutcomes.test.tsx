import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React, { useState } from "react";
import { usePredictionOutcomes } from "../usePredictionOutcomes";
import { DEFAULT_OUTCOMES } from "../../constants";

function TestComponent() {
  const [outcomes, setOutcomes] = useState(DEFAULT_OUTCOMES);
  const { onAddOutcome, onDelOutcome, onOutcomeChange } = usePredictionOutcomes(setOutcomes);

  return (
    <div>
      <div data-testid="count">{outcomes.length}</div>
      <div data-testid="first-label">{outcomes[0]?.label ?? ""}</div>
      <button type="button" onClick={onAddOutcome}>
        add
      </button>
      <button type="button" onClick={() => onOutcomeChange(0, "label", "新名称")}>
        change
      </button>
      <button type="button" onClick={() => onDelOutcome(0)}>
        delete
      </button>
    </div>
  );
}

describe("usePredictionOutcomes", () => {
  it("adds a new outcome", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("count").textContent).toBe("2");
    fireEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("updates outcome label", () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByText("change"));
    expect(screen.getByTestId("first-label").textContent).toBe("新名称");
  });

  it("deletes an outcome", () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByText("delete"));
    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
