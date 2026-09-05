import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildGuandanRoundDisplayModel,
  GuandanRoundResultContent,
} from "./GuandanRoundResultHud";

describe("GuandanRoundResultHud acceptance", () => {
  for (const playerCount of [4, 6, 8, 10, 12, 14]) {
    test(`${playerCount} players show winner and complete ranking without duplicate level badge`, () => {
      const players = Array.from(
        { length: playerCount },
        (_, index) => `玩家${index + 1}`,
      );
      const finishOrder = Array.from(
        { length: playerCount },
        (_, index) => index,
      );
      const model = buildGuandanRoundDisplayModel(
        "Three",
        players,
        finishOrder,
        0,
      );
      const html = renderToStaticMarkup(
        <GuandanRoundResultContent model={model} />,
      );

      expect(html).not.toContain("本局打");
      expect(html).toContain("本局赢家：玩家1");
      expect(html).toContain("赢家排列：");
      expect(html).toContain("第1名 玩家1");
      expect(html).toContain(`第${playerCount}名 玩家${playerCount}`);
      expect(model.finishOrder).toHaveLength(playerCount);
      expect(model.winnerName).toBe("玩家1");
    });
  }

  test("a missing level does not reintroduce the removed level badge", () => {
    const model = buildGuandanRoundDisplayModel(
      null,
      ["a", "b", "c", "d"],
      [2, 0, 3, 1],
      null,
    );
    const html = renderToStaticMarkup(
      <GuandanRoundResultContent model={model} />,
    );

    expect(html).not.toContain("本局打");
    expect(html).toContain("本局赢家：c");
    expect(html).toContain("第1名 c");
    expect(html).toContain("第4名 b");
  });

  test("incomplete finish order never reports a false final ranking", () => {
    const model = buildGuandanRoundDisplayModel(
      "Two",
      ["a", "b", "c", "d"],
      [0, 2],
      null,
    );
    const html = renderToStaticMarkup(
      <GuandanRoundResultContent model={model} />,
    );

    expect(html).not.toContain("本局打");
    expect(html).not.toContain("赢家排列：");
  });
});
