import { createDeck, dealHands } from "../dist/core/deck.js";
import { passGameTurn, playGameCards, startNextRound } from "../dist/core/game-state.js";
import { canHandBeat, classifyHand } from "../dist/core/hand.js";
import { createTableConfig } from "../dist/core/table.js";
import { createTrickState } from "../dist/core/trick-state.js";

const sizes = [4, 6, 8, 10, 12, 14];
const gamesPerSize = 3;
const actionLimit = 20000;

const createInitialState = (playerCount) => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: dealHands(createDeck(playerCount), playerCount),
  currentTurn: 0,
  trick: createTrickState(playerCount, 0),
  finishedSeats: [],
});

const playCompleteGame = (initialState) => {
  let state = initialState;
  let actions = 0;
  while (state.phase === "playing") {
    if (actions >= actionLimit) throw new Error(`game exceeded ${actionLimit} actions`);
    const seat = state.currentTurn;
    const hand = state.hands[seat];
    if (!hand || hand.length === 0) throw new Error(`invalid current hand at seat ${seat}`);
    const leadingHand = state.trick.leadingPlay?.hand ?? null;
    const playable = leadingHand === null
      ? hand[0]
      : hand.find((deckCard) => canHandBeat(classifyHand([deckCard.card]), leadingHand));
    state = playable === undefined
      ? passGameTurn(state, seat)
      : playGameCards(state, seat, [playable.card]);
    actions += 1;
  }
  if (state.phase !== "round-complete") throw new Error("game did not complete");
  if (state.finishedSeats.length !== state.config.playerCount) throw new Error("finish order incomplete");
  if (new Set(state.finishedSeats).size !== state.config.playerCount) throw new Error("finish order duplicated");
  if (state.winnerSeat !== state.finishedSeats[0]) throw new Error("winner mismatch");
  return { completed: state, actions };
};

for (const players of sizes) {
  let state = createInitialState(players);
  for (let game = 1; game <= gamesPerSize; game += 1) {
    const { completed, actions } = playCompleteGame(state);
    console.log(JSON.stringify({
      type: "EXACT_THREE_GAME_PASS",
      players,
      game,
      winnerSeat: completed.winnerSeat,
      finishOrder: completed.finishedSeats,
      actions,
    }));
    if (game < gamesPerSize) state = startNextRound(completed, () => 0);
  }
}

console.log("EXACT_THREE_GAME_MATRIX_PASS all=18");
