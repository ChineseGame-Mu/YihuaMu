import { type Card } from "./cards.js";
import { type DeckCard, deckCopiesForTable } from "./deck.js";
import { type SupportedPlayerCount } from "./table.js";

/**
 * Public-information-only card tracker for robot strategy.
 *
 * The caller supplies ONLY cards that have become public (e.g. cards played
 * face-up). Never pass private hands or server-internal deck order here.
 * A fresh tracker must be created for each deal.
 */
export interface PublicCardMemory {
  readonly playerCount: SupportedPlayerCount;
  readonly revealedIds: ReadonlySet<string>;
  readonly revealedByFace: ReadonlyMap<string, number>;
}

export const publicCardFace = (card: Card): string =>
  card.kind === "joker"
    ? `joker:${card.size}`
    : `${card.suit}:${card.rank}`;

export const createPublicCardMemory = (
  playerCount: SupportedPlayerCount,
): PublicCardMemory => ({
  playerCount,
  revealedIds: new Set<string>(),
  revealedByFace: new Map<string, number>(),
});

/**
 * Add newly public physical cards, exactly once. Replaying a snapshot is
 * idempotent, but a forged or impossible reveal is rejected.
 */
export const observePublicCards = (
  memory: PublicCardMemory,
  cards: readonly DeckCard[],
): PublicCardMemory => {
  const ids = new Set(memory.revealedIds);
  const faces = new Map(memory.revealedByFace);
  const copies = deckCopiesForTable(memory.playerCount);
  for (const { id, copy, card } of cards) {
    if (!Number.isInteger(copy) || copy < 0 || copy >= copies) {
      throw new Error("public card copy is outside this table's deck");
    }
    const expectedId =
      card.kind === "joker"
        ? `${copy}:joker:${card.size}`
        : `${copy}:${card.suit}:${card.rank}`;
    if (id !== expectedId) {
      throw new Error("public card identity does not match its face");
    }
    if (ids.has(id)) continue;
    const face = publicCardFace(card);
    const count = (faces.get(face) ?? 0) + 1;
    if (count > copies) {
      throw new Error("public card count exceeds deck multiplicity");
    }
    ids.add(id);
    faces.set(face, count);
  }
  return {
    playerCount: memory.playerCount,
    revealedIds: ids,
    revealedByFace: faces,
  };
};

/** Upper bound on unseen physical copies, NOT an opponent-hand inference. */
export const unseenPublicCopies = (
  memory: PublicCardMemory,
  card: Card,
): number =>
  deckCopiesForTable(memory.playerCount) -
  (memory.revealedByFace.get(publicCardFace(card)) ?? 0);
