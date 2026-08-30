import { describe, expect, it } from "vitest";
import {
  availableGameMachineActions,
  transitionGame,
} from "../src/core/game-machine.js";
import { createLobbyState, type PlayingState } from "../src/core/game-state.js";

const deterministicRandom = (): number => 0;

describe("opening draw to card-id table machine", () => {
  it("carries an independent opening draw into classified card-id play and pass state", () => {
    const lobby = createLobbyState(4, 0);

    const opening = transitionGame(
      lobby,
      { type: "begin-opening-draw" },
      deterministicRandom,
    );
    expect(opening.phase).toBe("opening-draw");
    if (opening.phase !== "opening-draw") throw new Error("opening draw expected");
    expect(opening.openingDraw.attempts.length).toBeGreaterThan(0);
    expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
    expect(opening.openingDraw.winnerSeat).toBeLessThan(4);

    const dealt = transitionGame(
      opening,
      { type: "deal-after-opening-draw" },
      deterministicRandom,
    );
    expect(dealt.phase).toBe("playing");
    if (dealt.phase !== "playing") throw new Error("playing state expected");
    expect(availableGameMachineActions(dealt)).toContain("play-card-ids");

    const leader = dealt.currentTurn;
    const leaderHand = dealt.hands[leader];
    const firstCard = leaderHand?.[0];
    if (!firstCard) throw new Error("leader hand must contain a card");

    const played = transitionGame(dealt, {
      type: "play-card-ids",
      seat: leader,
      cardIds: [firstCard.id],
    });
    expect(played.phase).toBe("playing");
    if (played.phase !== "playing") throw new Error("playing state expected");
    expect(played.hands[leader]).toHaveLength(leaderHand.length - 1);
    expect(played.trick.leadingPlay?.seat).toBe(leader);
    expect(played.trick.leadingPlay?.hand.kind).toBe("single");

    const responder = played.currentTurn;
    const passed = transitionGame(played, {
      type: "pass-turn",
      seat: responder,
    });
    expect(passed.phase).toBe("playing");
    const playingPassed = passed as PlayingState;
    expect(playingPassed.trick.passedSeats).toContain(responder);
    expect(playingPassed.currentTurn).not.toBe(responder);
  });
});
