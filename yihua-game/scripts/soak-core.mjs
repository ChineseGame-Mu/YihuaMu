import { createDeck, dealHands } from "../dist/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  startNextRound,
} from "../dist/core/game-state.js";
import { canHandBeat, classifyHand } from "../dist/core/hand.js";
import {
  SUPPORTED_PLAYER_COUNTS,
  createTableConfig,
} from "../dist/core/table.js";
import { createTrickState } from "../dist/core/trick-state.js";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const durationMs = Number(process.env.SOAK_DURATION_MS ?? THREE_HOURS_MS);
const actionLimit = Number(process.env.SOAK_ACTION_LIMIT ?? 10000);
const requestedCounts = process.env.SOAK_PLAYER_COUNTS
  ? process.env.SOAK_PLAYER_COUNTS.split(",").map((value) => Number(value.trim()))
  : [...SUPPORTED_PLAYER_COUNTS];

const assertSupportedCounts = () => {
  for (const count of requestedCounts) {
    if (!SUPPORTED_PLAYER_COUNTS.includes(count)) {
      throw new Error(`unsupported player count requested: ${count}`);
    }
  }
};

const createInitialState = (playerCount) => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: dealHands(createDeck(playerCount), playerCount),
  currentTurn: 0,
  trick: createTrickState(playerCount, 0),
  finishedSeats: [],
});

const auditPlayingState = (state) => {
  if (state.phase !== "playing") return;
  if (state.currentTurn < 0 || state.currentTurn >= state.config.playerCount) {
    throw new Error("currentTurn is outside the table");
  }
  if (state.hands.length !== state.config.playerCount) {
    throw new Error("hand count does not match player count");
  }
  const finished = state.finishedSeats ?? [];
  if (new Set(finished).size !== finished.length) {
    throw new Error("finishedSeats contains duplicates");
  }
  if (finished.includes(state.currentTurn)) {
    throw new Error("currentTurn points to a finished seat");
  }
  if (state.hands[state.currentTurn]?.length === 0) {
    throw new Error("currentTurn points to an empty hand");
  }
};

const playOneRound = (initialState, metrics) => {
  let state = initialState;
  let actions = 0;

  while (state.phase === "playing") {
    if (actions >= actionLimit) {
      metrics.deadlocks += 1;
      throw new Error(`round exceeded action limit ${actionLimit}`);
    }

    auditPlayingState(state);
    const seat = state.currentTurn;
    const hand = state.hands[seat];
    const leadingHand = state.trick.leadingPlay?.hand ?? null;
    const playable =
      leadingHand === null
        ? hand[0]
        : hand.find((deckCard) =>
            canHandBeat(classifyHand([deckCard.card]), leadingHand),
          );

    if (playable === undefined) {
      state = passGameTurn(state, seat);
      metrics.passes += 1;
    } else {
      state = playGameCards(state, seat, [playable.card]);
      metrics.plays += 1;
    }
    actions += 1;
    metrics.actions += 1;
  }

  if (state.finishedSeats.length !== state.config.playerCount) {
    throw new Error("completed round does not contain every placement");
  }
  if (new Set(state.finishedSeats).size !== state.config.playerCount) {
    throw new Error("completed round placements are not unique");
  }
  metrics.rounds += 1;
  return state;
};

const runTableSoak = (playerCount) => {
  const startedAt = Date.now();
  const deadline = startedAt + durationMs;
  const metrics = {
    playerCount,
    durationMs,
    rounds: 0,
    actions: 0,
    plays: 0,
    passes: 0,
    reconnects: 0,
    deadlocks: 0,
    stateErrors: 0,
    crashes: 0,
  };

  let state = createInitialState(playerCount);
  try {
    while (Date.now() < deadline) {
      const completed = playOneRound(state, metrics);
      state = startNextRound(completed, () => 0);
    }
  } catch (error) {
    metrics.stateErrors += 1;
    metrics.crashes += 1;
    console.error(JSON.stringify({ ...metrics, error: String(error) }));
    throw error;
  }

  const result = { ...metrics, elapsedMs: Date.now() - startedAt };
  console.log(JSON.stringify(result));
  return result;
};

assertSupportedCounts();
const results = requestedCounts.map(runTableSoak);
if (results.some(({ deadlocks, stateErrors, crashes }) => deadlocks || stateErrors || crashes)) {
  process.exitCode = 1;
}
