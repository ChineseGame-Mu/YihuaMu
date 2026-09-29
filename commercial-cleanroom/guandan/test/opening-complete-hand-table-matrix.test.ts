import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  playTableCards,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const fixedRandom = () => 0;

const suited = (
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"],
): Card => ({ kind: "suited", rank, suit });

const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

const HAND_CASES: readonly {
  name: string;
  kind: string;
  cards: readonly Card[];
}[] = [
  { name: "single", kind: "single", cards: [suited("9", "clubs")] },
  {
    name: "pair",
    kind: "pair",
    cards: [suited("9", "clubs"), suited("9", "hearts")],
  },
  {
    name: "triple",
    kind: "triple",
    cards: [
      suited("9", "clubs"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
    ],
  },
  {
    name: "full house",
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
    name: "straight",
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
    name: "straight flush",
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
    name: "consecutive pairs",
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
    name: "consecutive triples",
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
    name: "four-card bomb",
    kind: "bomb",
    cards: [
      suited("Q", "clubs"),
      suited("Q", "diamonds"),
      suited("Q", "spades"),
      suited("Q", "hearts"),
    ],
  },
  {
    name: "joker bomb",
    kind: "joker-bomb",
    cards: [joker("small"), joker("small"), joker("big"), joker("big")],
  },
];

describe("opening draw -> complete hand families -> table state", () => {
  for (const playerCount of PLAYER_COUNTS) {
    for (const handCase of HAND_CASES) {
      it(`${playerCount} players accepts ${handCase.name} from the opening winner`, () => {
        const opening = createTableRoundState(
          createDeck(playerCount),
          playerCount,
          fixedRandom,
        );
        const playing = completeTableOpeningDraw(opening);
        const winnerSeat = playing.openingDraw.winnerSeat;

        expect(playing.phase).toBe("playing");
        expect(winnerSeat).not.toBeNull();
        if (winnerSeat === null || playing.trick === null) {
          throw new Error("opening draw must produce a playing leader");
        }

        const afterPlay = playTableCards(playing, winnerSeat, handCase.cards);

        expect(afterPlay.phase).toBe("playing");
        expect(afterPlay.trick?.leadingPlay?.seat).toBe(winnerSeat);
        expect(afterPlay.trick?.leadingPlay?.hand.kind).toBe(handCase.kind);
        expect(afterPlay.trick?.leadingPlay?.hand.size).toBe(
          handCase.cards.length,
        );
        expect(afterPlay.trick?.passedSeats).toEqual([]);
        expect(afterPlay.trick?.currentTurn).toBe(
          (winnerSeat + 1) % playerCount,
        );
      });
    }
  }
});
