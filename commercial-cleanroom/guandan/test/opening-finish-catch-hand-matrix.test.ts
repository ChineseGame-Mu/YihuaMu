import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
} from "../src/core/table-state-machine.js";
import {
  teammateSeatsForSeat,
  type SupportedPlayerCount,
} from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const fixedRandom = () => 0;

const suited = (
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"],
): Card => ({ kind: "suited", rank, suit });

const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

const HAND_CASES: readonly { kind: string; cards: readonly Card[] }[] = [
  { kind: "single", cards: [suited("9", "clubs")] },
  {
    kind: "pair",
    cards: [suited("9", "clubs"), suited("9", "hearts")],
  },
  {
    kind: "triple",
    cards: [
      suited("9", "clubs"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
    ],
  },
  {
    kind: "full-house",
    cards: [
      suited("9", "clubs"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
      suited("K", "clubs"),
      suited("K", "hearts"),
    ],
  },
  {
    kind: "straight",
    cards: [
      suited("5", "clubs"),
      suited("6", "diamonds"),
      suited("7", "hearts"),
      suited("8", "spades"),
      suited("9", "clubs"),
    ],
  },
  {
    kind: "straight-flush",
    cards: [
      suited("5", "spades"),
      suited("6", "spades"),
      suited("7", "spades"),
      suited("8", "spades"),
      suited("9", "spades"),
    ],
  },
  {
    kind: "consecutive-pairs",
    cards: [
      suited("5", "clubs"),
      suited("5", "hearts"),
      suited("6", "clubs"),
      suited("6", "hearts"),
      suited("7", "clubs"),
      suited("7", "hearts"),
    ],
  },
  {
    kind: "consecutive-triples",
    cards: [
      suited("5", "clubs"),
      suited("5", "diamonds"),
      suited("5", "hearts"),
      suited("6", "clubs"),
      suited("6", "diamonds"),
      suited("6", "hearts"),
    ],
  },
  {
    kind: "bomb",
    cards: [
      suited("Q", "clubs"),
      suited("Q", "diamonds"),
      suited("Q", "spades"),
      suited("Q", "hearts"),
    ],
  },
  {
    kind: "joker-bomb",
    cards: [joker("small"), joker("small"), joker("big"), joker("big")],
  },
];

const nearestTeammate = (
  playerCount: SupportedPlayerCount,
  seat: number,
  activeSeats: readonly number[],
): number => {
  const active = new Set(activeSeats);
  const teammates = teammateSeatsForSeat(playerCount, seat).filter(
    (candidate) => active.has(candidate),
  );
  if (teammates.length === 0) throw new Error("active teammate expected");
  return teammates.reduce((nearest, candidate) => {
    const nearestDistance = (nearest - seat + playerCount) % playerCount;
    const candidateDistance = (candidate - seat + playerCount) % playerCount;
    return candidateDistance < nearestDistance ? candidate : nearest;
  });
};

describe("opening winner -> complete hand family -> finish -> teammate catch lead", () => {
  for (const playerCount of PLAYER_COUNTS) {
    for (const handCase of HAND_CASES) {
      it(`${playerCount} players catches the lead after a finishing ${handCase.kind}`, () => {
        const opening = createTableRoundState(
          createDeck(playerCount),
          playerCount,
          fixedRandom,
        );
        const playing = completeTableOpeningDraw(opening);
        const winnerSeat = playing.openingDraw.winnerSeat;
        if (winnerSeat === null) throw new Error("opening winner expected");

        let state = playTableCards(playing, winnerSeat, handCase.cards, {
          finishesHand: true,
        });

        expect(state.finishingOrder).toEqual([winnerSeat]);
        expect(state.activeSeats).not.toContain(winnerSeat);
        expect(state.trick?.leadingPlay?.hand.kind).toBe(handCase.kind);

        let guard = 0;
        while (state.trick?.leadingPlay !== null) {
          const seat = state.trick?.currentTurn;
          if (seat === undefined) throw new Error("current turn expected");
          state = passTableTurn(state, seat);
          guard += 1;
          if (guard > playerCount) throw new Error("trick did not close");
        }

        const expectedCatch = nearestTeammate(
          playerCount,
          winnerSeat,
          state.activeSeats,
        );
        expect(state.phase).toBe("playing");
        expect(state.trick?.leaderSeat).toBe(expectedCatch);
        expect(state.trick?.currentTurn).toBe(expectedCatch);
        expect(state.trick?.completedTricks).toBe(1);
        expect(state.trick?.passedSeats).toEqual([]);
      });
    }
  }
});
