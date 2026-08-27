import { canHandBeat, classifyHand } from "../dist/core/hand.js";
import { createServerRuntime } from "../dist/core/server-runtime.js";
import { SUPPORTED_PLAYER_COUNTS } from "../dist/core/table.js";
import { attachUpgradedConnection } from "../dist/core/websocket-upgrade.js";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const durationMs = Number(process.env.SOAK_DURATION_MS ?? THREE_HOURS_MS);
const actionLimit = Number(process.env.SOAK_ACTION_LIMIT ?? 10000);
const reconnectEvery = Number(process.env.SOAK_RECONNECT_EVERY ?? 75);
const requestedCounts = process.env.SOAK_PLAYER_COUNTS
  ? process.env.SOAK_PLAYER_COUNTS.split(",").map((value) =>
      Number(value.trim()),
    )
  : [...SUPPORTED_PLAYER_COUNTS];

class CountingSocket {
  sentCount = 0;
  messages = [];

  send(text) {
    this.sentCount += 1;
    this.messages.push(text);
  }
}

class FakeConnection {
  socket = new CountingSocket();
  textHandler;
  closeHandler;

  constructor(context) {
    this.context = context;
  }

  onText(handler) {
    this.textHandler = handler;
  }

  onClose(handler) {
    this.closeHandler = handler;
  }

  async receive(text) {
    if (!this.textHandler) throw new Error("connection has no text handler");
    await this.textHandler(text);
  }

  async close() {
    if (!this.closeHandler) throw new Error("connection has no close handler");
    await this.closeHandler();
  }
}

const assertConfiguration = () => {
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    throw new Error("SOAK_DURATION_MS must be positive");
  if (!Number.isInteger(actionLimit) || actionLimit <= 0)
    throw new Error("SOAK_ACTION_LIMIT must be a positive integer");
  if (!Number.isInteger(reconnectEvery) || reconnectEvery <= 0)
    throw new Error("SOAK_RECONNECT_EVERY must be a positive integer");
  for (const count of requestedCounts) {
    if (!SUPPORTED_PLAYER_COUNTS.includes(count))
      throw new Error(`unsupported player count requested: ${count}`);
  }
};

const auditRoom = (table) => {
  const managed = table.runtime.rooms.get(table.roomId);
  const { game, room } = managed;
  if (room.participants.length !== table.playerCount)
    throw new Error(`${table.roomId}: participant count changed`);
  if (new Set(room.participants.map(({ id }) => id)).size !== table.playerCount)
    throw new Error(`${table.roomId}: duplicate participant id`);
  if (
    new Set(room.participants.map(({ seat }) => seat)).size !==
    table.playerCount
  )
    throw new Error(`${table.roomId}: duplicate participant seat`);
  for (const participant of room.participants) {
    if (participant.kind !== "human")
      throw new Error(`${table.roomId}: unexpected robot participant`);
    if (!participant.connected)
      throw new Error(`${table.roomId}: participant remained disconnected`);
    if (
      table.runtime.sockets.playerConnectionCount(
        table.roomId,
        participant.id,
      ) !== 1
    )
      throw new Error(
        `${table.roomId}: player socket count is not exactly one`,
      );
  }
  if (game.phase === "playing") {
    if (game.currentTurn < 0 || game.currentTurn >= table.playerCount)
      throw new Error(`${table.roomId}: currentTurn is outside table`);
    const finished = game.finishedSeats ?? [];
    if (new Set(finished).size !== finished.length)
      throw new Error(`${table.roomId}: duplicate finished seat`);
    if (finished.includes(game.currentTurn))
      throw new Error(`${table.roomId}: finished seat owns current turn`);
    if (game.hands[game.currentTurn]?.length === 0)
      throw new Error(`${table.roomId}: current turn has empty hand`);
    const handIds = game.hands.flatMap((hand) => hand.map(({ id }) => id));
    if (new Set(handIds).size !== handIds.length)
      throw new Error(`${table.roomId}: duplicate physical card id in hands`);
  } else if (game.phase === "round-complete") {
    if (game.finishedSeats.length !== table.playerCount)
      throw new Error(`${table.roomId}: incomplete final placement list`);
    if (new Set(game.finishedSeats).size !== table.playerCount)
      throw new Error(`${table.roomId}: duplicate final placement`);
  } else {
    throw new Error(`${table.roomId}: unexpected game phase ${game.phase}`);
  }
};

const attachPlayer = async (table, seat) => {
  const playerId = `p${seat}`;
  const connection = new FakeConnection({ roomId: table.roomId, playerId });
  await attachUpgradedConnection(table.runtime, connection);
  table.connections.set(seat, connection);
  return connection;
};

const auditReconnectSnapshot = (table, seat, connection, managed) => {
  const messages = connection.socket.messages.map((text) => JSON.parse(text));
  const roomState = messages.find(({ type }) => type === "room_state");
  const gameState = messages.find(({ type }) => type === "game_state");
  const privateHand = messages.find(({ type }) => type === "private_hand");
  if (!roomState || !gameState || !privateHand)
    throw new Error(`${table.roomId}: reconnect snapshot is incomplete`);
  if (
    [roomState.revision, gameState.revision, privateHand.revision].some(
      (revision) => revision !== managed.revision,
    )
  )
    throw new Error(`${table.roomId}: reconnect snapshot revisions disagree`);
  if (gameState.currentTurn !== managed.game.currentTurn)
    throw new Error(`${table.roomId}: reconnect currentTurn mismatch`);
  if (
    JSON.stringify(gameState.handCounts) !==
    JSON.stringify(managed.game.hands.map((hand) => hand.length))
  )
    throw new Error(`${table.roomId}: reconnect handCounts mismatch`);
  const expectedLeading =
    managed.game.trick.leadingPlay === null
      ? null
      : {
          seat: managed.game.trick.leadingPlay.seat,
          cards: managed.game.trick.leadingPlay.cards,
        };
  if (JSON.stringify(gameState.leadingPlay) !== JSON.stringify(expectedLeading))
    throw new Error(`${table.roomId}: reconnect leadingPlay mismatch`);
  if (
    JSON.stringify(gameState.passedSeats) !==
    JSON.stringify(managed.game.trick.passedSeats)
  )
    throw new Error(`${table.roomId}: reconnect passedSeats mismatch`);
  if (
    JSON.stringify(gameState.finishedSeats) !==
    JSON.stringify(managed.game.finishedSeats ?? [])
  )
    throw new Error(`${table.roomId}: reconnect finishedSeats mismatch`);
  if (gameState.completedTricks !== managed.game.trick.completedTricks)
    throw new Error(`${table.roomId}: reconnect completedTricks mismatch`);
  if (privateHand.seat !== seat)
    throw new Error(`${table.roomId}: reconnect private seat mismatch`);
  const expectedCards = managed.game.hands[seat].map(({ id, card }) => ({
    id,
    card,
  }));
  if (JSON.stringify(privateHand.cards) !== JSON.stringify(expectedCards))
    throw new Error(`${table.roomId}: reconnect private hand mismatch`);
};

const createTable = async (playerCount) => {
  const runtime = createServerRuntime();
  const roomId = `soak-${playerCount}`;
  runtime.rooms.create(roomId, playerCount);
  const table = {
    runtime,
    roomId,
    playerCount,
    connections: new Map(),
    actionsInRound: 0,
    commandSequence: 0,
    metrics: {
      playerCount,
      rounds: 0,
      actions: 0,
      plays: 0,
      passes: 0,
      reconnects: 0,
      staleErrors: 0,
      deadlocks: 0,
      stateErrors: 0,
      crashes: 0,
    },
  };
  for (let seat = 0; seat < playerCount; seat += 1) {
    const connection = await attachPlayer(table, seat);
    const revision = runtime.rooms.get(roomId).revision;
    await connection.receive(
      JSON.stringify({
        type: "join_room",
        roomId,
        playerId: `p${seat}`,
        name: `玩家${seat + 1}`,
        seat,
        expectedRevision: revision,
        commandId: `join-${seat}`,
      }),
    );
  }
  const first = table.connections.get(0);
  if (!first) throw new Error(`${roomId}: seat zero connection missing`);
  await first.receive(
    JSON.stringify({
      type: "start_game",
      expectedRevision: runtime.rooms.get(roomId).revision,
      commandId: "start-game",
    }),
  );
  auditRoom(table);
  return table;
};

const reconnectOnePlayer = async (table) => {
  const seat = table.metrics.actions % table.playerCount;
  const current = table.connections.get(seat);
  if (!current) throw new Error(`${table.roomId}: reconnect target missing`);
  const beforeClose = table.runtime.rooms.get(table.roomId).revision;
  await current.close();
  const afterClose = table.runtime.rooms.get(table.roomId);
  if (afterClose.revision !== beforeClose + 1)
    throw new Error(
      `${table.roomId}: disconnect did not advance revision once`,
    );
  const replacement = await attachPlayer(table, seat);
  const afterReconnect = table.runtime.rooms.get(table.roomId);
  if (afterReconnect.revision !== afterClose.revision + 1)
    throw new Error(`${table.roomId}: reconnect did not advance revision once`);
  auditReconnectSnapshot(table, seat, replacement, afterReconnect);
  table.metrics.reconnects += 1;
};

const sendGameCommand = async (table) => {
  const managed = table.runtime.rooms.get(table.roomId);
  const { game } = managed;
  if (game.phase === "round-complete") {
    const firstPlaceSeat = game.outcome?.firstPlaceSeat ?? game.winnerSeat;
    const openingDraw = JSON.stringify(game.openingDraw);
    const connection = table.connections.get(firstPlaceSeat);
    if (!connection)
      throw new Error(`${table.roomId}: next-round leader missing`);
    table.commandSequence += 1;
    await connection.receive(
      JSON.stringify({
        type: "next_round",
        expectedRevision: managed.revision,
        commandId: `next-${table.commandSequence}`,
      }),
    );
    const next = table.runtime.rooms.get(table.roomId);
    if (next.revision !== managed.revision + 1)
      throw new Error(`${table.roomId}: next_round revision mismatch`);
    if (next.game.phase !== "playing")
      throw new Error(
        `${table.roomId}: next_round did not enter playing phase`,
      );
    if (next.game.currentTurn !== firstPlaceSeat)
      throw new Error(`${table.roomId}: first place did not lead next round`);
    if (next.game.hands.some((hand) => hand.length !== 27))
      throw new Error(`${table.roomId}: next round hand count is not 27`);
    if (JSON.stringify(next.game.openingDraw) !== openingDraw)
      throw new Error(`${table.roomId}: opening draw changed between rounds`);
    table.actionsInRound = 0;
    table.metrics.rounds += 1;
    return;
  }
  if (game.phase !== "playing")
    throw new Error(`${table.roomId}: game is not playable`);
  if (table.actionsInRound >= actionLimit) {
    table.metrics.deadlocks += 1;
    throw new Error(
      `${table.roomId}: round exceeded action limit ${actionLimit}`,
    );
  }
  const seat = game.currentTurn;
  const connection = table.connections.get(seat);
  const hand = game.hands[seat];
  if (!connection || !hand)
    throw new Error(`${table.roomId}: active player missing`);
  const leadingHand = game.trick.leadingPlay?.hand ?? null;
  const playable =
    leadingHand === null
      ? hand[0]
      : hand.find((deckCard) =>
          canHandBeat(classifyHand([deckCard.card]), leadingHand),
        );
  table.commandSequence += 1;
  const revision = managed.revision;
  if (playable === undefined) {
    await connection.receive(
      JSON.stringify({
        type: "pass_turn",
        expectedRevision: revision,
        commandId: `pass-${table.commandSequence}`,
      }),
    );
    table.metrics.passes += 1;
  } else {
    await connection.receive(
      JSON.stringify({
        type: "play_cards",
        cardIds: [playable.id],
        expectedRevision: revision,
        commandId: `play-${table.commandSequence}`,
      }),
    );
    table.metrics.plays += 1;
  }
  const after = table.runtime.rooms.get(table.roomId);
  if (after.revision !== revision + 1)
    throw new Error(`${table.roomId}: game command revision mismatch`);
  table.actionsInRound += 1;
  table.metrics.actions += 1;
  if (table.metrics.actions % reconnectEvery === 0)
    await reconnectOnePlayer(table);
};

assertConfiguration();
const tables = [];
for (const playerCount of requestedCounts)
  tables.push(await createTable(playerCount));
const startedAt = Date.now();
const deadline = startedAt + durationMs;
try {
  while (Date.now() < deadline) {
    for (const table of tables) {
      await sendGameCommand(table);
      auditRoom(table);
      if (Date.now() >= deadline) break;
    }
  }
} catch (error) {
  for (const table of tables) {
    table.metrics.stateErrors += 1;
    table.metrics.crashes += 1;
  }
  console.error(
    JSON.stringify({
      elapsedMs: Date.now() - startedAt,
      error: String(error),
      tables: tables.map(({ metrics }) => metrics),
    }),
  );
  throw error;
}
const result = {
  elapsedMs: Date.now() - startedAt,
  durationMs,
  tables: tables.map(({ metrics }) => metrics),
};
console.log(JSON.stringify(result));
if (
  result.tables.some(
    ({ deadlocks, stateErrors, crashes }) =>
      deadlocks || stateErrors || crashes,
  )
)
  process.exitCode = 1;
