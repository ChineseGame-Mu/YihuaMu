import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GuandanLastRoundScoreboard from "./GuandanLastRoundScoreboard";
import { GuandanStateContext } from "./GuandanStateProvider";
import { initialGuandanTableState } from "./guandanCompatibilityAdapter";

describe("persistent last-round scoreboard", () => {
  test("shows the winning player's name and promotion steps", () => {
    const state = {
      ...initialGuandanTableState,
      players: ["A", "B", "C", "D"],
      lastGameWinner: 2,
      lastPromotionSteps: 3,
    };

    const html = renderToStaticMarkup(
      <GuandanStateContext.Provider value={{ state, reset: () => {} }}>
        <GuandanLastRoundScoreboard />
      </GuandanStateContext.Provider>,
    );

    expect(html).toContain("本局打");
    expect(html).toContain("<strong>C</strong>");
    expect(html).toContain("+3");
  });

  test("keeps the scoreboard mounted before a result exists", () => {
    const html = renderToStaticMarkup(
      <GuandanStateContext.Provider
        value={{ state: initialGuandanTableState, reset: () => {} }}
      >
        <GuandanLastRoundScoreboard />
      </GuandanStateContext.Provider>,
    );

    expect(html).toContain("本局打");
    expect(html).toContain("<strong>—</strong>");
  });
});
