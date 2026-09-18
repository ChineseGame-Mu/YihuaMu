import {
  gameStateToLegacy,
  privateHandToLegacy,
  roomStateToLegacyWaiting,
  toCleanroomCommand,
  type FrontendCompatState,
  type LegacyClientMessage,
  type LegacyServerMessage,
} from "./frontend-compat.js";
import {
  applyLegacyTributeSelection,
  decorateLegacyTributeState,
  hasPendingLegacyTribute,
  prepareLegacyTribute,
  resolveLegacyTributeResistance,
  runLegacyRobotTribute,
} from "./legacy-tribute.js";
import { RANKS, type Rank } from "./cards.js";
import { classifyGameCardIds } from "./game-actions.js";
import type { ServerMessage } from "./protocol.js";
import {
  addObserver,
  choosePartner,
  moveParticipantSeat,
  disconnectHuman,
  disconnectObserver,
  reconnectHuman,
  reconnectObserver,
  removeParticipant,
  removeObserver,
  replaceRobotWithHuman,
  setParticipationForNextRound,
} from "./room.js";
import type { ServerRuntime } from "./server-runtime.js";
import type { SupportedPlayerCount } from "./table.js";
import type { TextSocket } from "./websocket-service.js";
import type { UpgradedConnection } from "./websocket-upgrade.js";
import { robotPatternPriority } from "./robot-strategy.js";

const LEGACY_PENDING_ROOM = "__legacy_guandan_pending__";
const ROBOT_TURN_DELAY_MS = 900;

type LegacyStateMessage = Extract<
  LegacyServerMessage,
  { readonly type: "state" }
>;

interface PendingLegacyTrick {
  readonly completedTricks: number;
  readonly winner: number;
  readonly lastPlay: LegacyStateMessage["last_play"];
  readonly tablePlays: LegacyStateMessage["table_plays"];
}

const pendingLegacyTricks = new Map<string, PendingLegacyTrick>();
const startedLegacyGames = new Set<string>();

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const legacyTrickStarted = (
  roomId: string,
  managed: ReturnType<ServerRuntime["rooms"]["get"]>,
): boolean =>
  managed.game.phase === "playing" && startedLegacyGames.has(roomId);

const robotCandidateCardIds = (hand: readonly any[]): string[][] => {
  const candidates: string[][] = [];
  const seen = new Set<string>();
  const add = (cards: readonly any[]): void => {
    const ids = cards.map(({ id }) => id as string);
    const key = [...ids].sort().join("|");
    if (ids.length > 0 && !seen.has(key)) {
      seen.add(key);
      candidates.push(ids);
    }
  };

  const suited = hand.filter(({ card }) => card.kind === "suited");
  const byRank = new Map<string, any[]>();
  const bySuitRank = new Map<string, any[]>();
  for (const entry of suited) {
    const rankGroup = byRank.get(entry.card.rank) ?? [];
    rankGroup.push(entry);
    byRank.set(entry.card.rank, rankGroup);
    const suitKey = `${entry.card.suit}:${entry.card.rank}`;
    const suitGroup = bySuitRank.get(suitKey) ?? [];
    suitGroup.push(entry);
    bySuitRank.set(suitKey, suitGroup);
  }

  const ranks = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];
  const straightWindows = [
    ["A", "2", "3", "4", "5"],
    ["2", "3", "4", "5", "6"],
    ...Array.from({ length: 9 }, (_, index) =>
      ranks.slice(index + 1, index + 6),
    ),
  ].filter((window) => window.length === 5);

  for (const group of byRank.values()) {
    if (group.length >= 3) add(group.slice(0, 3));
    if (group.length >= 2) add(group.slice(0, 2));
  }

  for (const [tripleRank, tripleGroup] of byRank.entries()) {
    if (tripleGroup.length < 3) continue;
    for (const [pairRank, pairGroup] of byRank.entries()) {
      if (pairRank !== tripleRank && pairGroup.length >= 2) {
        add([...tripleGroup.slice(0, 3), ...pairGroup.slice(0, 2)]);
      }
    }
  }

  for (const window of straightWindows) {
    const groups = window.map((rank) => byRank.get(rank));
    if (groups.every((group) => group !== undefined && group.length > 0)) {
      add(groups.map((group) => group![0]!));
    }
    for (const suit of ["clubs", "diamonds", "spades", "hearts"]) {
      const suitedGroups = window.map((rank) =>
        bySuitRank.get(`${suit}:${rank}`),
      );
      if (
        suitedGroups.every((group) => group !== undefined && group.length > 0)
      ) {
        add(suitedGroups.map((group) => group![0]!));
      }
    }
  }

  for (let index = 1; index <= ranks.length - 3; index += 1) {
    const groups = ranks
      .slice(index, index + 3)
      .map((rank) => byRank.get(rank));
    if (groups.every((group) => group !== undefined && group.length >= 2)) {
      add(groups.flatMap((group) => group!.slice(0, 2)));
    }
  }

  for (let index = 1; index <= ranks.length - 2; index += 1) {
    const groups = ranks
      .slice(index, index + 2)
      .map((rank) => byRank.get(rank));
    if (groups.every((group) => group !== undefined && group.length >= 3)) {
      add(groups.flatMap((group) => group!.slice(0, 3)));
    }
  }

  for (const group of byRank.values()) {
    for (let size = group.length; size >= 4; size -= 1) {
      add(group.slice(0, size));
    }
  }

  const smallJokers = hand.filter(
    ({ card }) => card.kind === "joker" && card.size === "small",
  );
  const bigJokers = hand.filter(
    ({ card }) => card.kind === "joker" && card.size === "big",
  );
  if (smallJokers.length >= 2) add(smallJokers.slice(0, 2));
  if (bigJokers.length >= 2) add(bigJokers.slice(0, 2));
  if (smallJokers.length >= 2 && bigJokers.length >= 2) {
    add([...smallJokers.slice(0, 2), ...bigJokers.slice(0, 2)]);
  }

  for (const card of hand) add([card]);
  return candidates;
};

const robotNormalStrength = (
  hand: ReturnType<typeof classifyGameCardIds>,
  levelRank: Rank,
): number => {
  if (hand.jokerSize !== undefined) {
    return RANKS.length + 2 + (hand.jokerSize === "big" ? 1 : 0);
  }
  const rank = hand.rank ?? hand.highRank;
  if (rank === undefined) return 0;
  if (rank === levelRank && hand.highRank === undefined)
    return RANKS.length + 1;
  return RANKS.indexOf(rank);
};

const robotCandidatePriority = (
  game: any,
  seat: number,
  cardIds: readonly string[],
): number => {
  const hand = classifyGameCardIds(game, seat, cardIds, game.levelRank);
  const strength = robotNormalStrength(hand, game.levelRank ?? "2");
  return robotPatternPriority({
    kind: hand.kind,
    strength,
    size: "size" in hand ? hand.size : undefined,
    leading: game.trick.leadingPlay === null,
    leadCycle: game.trick.completedTricks + seat,
  });
};

export const legacyNextRoundRobotState = (
  managed: ReturnType<ServerRuntime["rooms"]["get"]>,
): { readonly shuffleReady: boolean; readonly winnerIsRobot: boolean } => {
  if (managed.game.phase !== "round-complete") {
    return { shuffleReady: false, winnerIsRobot: false };
  }
  const winnerSeat = managed.game.finishedSeats[0];
  if (winnerSeat === undefined) {
    return { shuffleReady: false, winnerIsRobot: false };
  }
  const winner = managed.room.participants.find(
    ({ seat }) => seat === winnerSeat,
  );
  const shuffleReady = managed.room.participants.some(
    ({ seat, kind, readyForNextRound, leavingAfterRound }) =>
      seat % 2 !== winnerSeat % 2 &&
      (kind === "robot" ||
        readyForNextRound === true ||
        leavingAfterRound === true),
  );
  return {
    shuffleReady,
    winnerIsRobot:
      winner?.kind === "robot" || winner?.leavingAfterRound === true,
  };
};

const advanceLegacyRobotNextRound = async (
  runtime: ServerRuntime,
  roomId: string,
): Promise<boolean> => {
  const managed = runtime.rooms.get(roomId);
  const { shuffleReady, winnerIsRobot } = legacyNextRoundRobotState(managed);
  if (!shuffleReady || !winnerIsRobot) return false;

  await sleep(ROBOT_TURN_DELAY_MS);
  const current = runtime.rooms.get(roomId);
  const currentState = legacyNextRoundRobotState(current);
  if (
    current.game.phase !== "round-complete" ||
    !currentState.shuffleReady ||
    !currentState.winnerIsRobot
  )
    return false;

  prepareLegacyTribute(roomId, current.game.finishedSeats);
  const next = runtime.rooms.nextRound(roomId);
  startedLegacyGames.delete(roomId);
  await runtime.websocket.broadcastRoomState(next);
  await runtime.websocket.broadcastGameState(next);
  await runtime.websocket.sendPrivateHands(next);
  if (resolveLegacyTributeResistance(roomId, next)) {
    await runtime.websocket.broadcastGameState(next);
  } else {
    await runLegacyRobotTribute(runtime, roomId);
  }
  await startLegacyPlayWhenTributeComplete(runtime, roomId);
  return true;
};

const clearRobotWonTrick = async (
  runtime: ServerRuntime,
  roomId: string,
  beforeCompletedTricks: number,
): Promise<boolean> => {
  const managed = runtime.rooms.get(roomId);
  if (
    managed.game.phase !== "playing" ||
    managed.game.trick.completedTricks <= beforeCompletedTricks
  ) {
    return false;
  }
  const winnerSeat = managed.game.currentTurn;
  const winner = managed.room.participants.find(
    ({ seat }) => seat === winnerSeat,
  );
  if (winner?.kind !== "robot") return false;

  await sleep(1200);
  pendingLegacyTricks.delete(roomId);
  await runtime.websocket.broadcastGameState(runtime.rooms.get(roomId));
  return true;
};

const runLegacyRobots = async (
  runtime: ServerRuntime,
  roomId: string,
): Promise<void> => {
  for (let guard = 0; guard < 64; guard += 1) {
    let managed = runtime.rooms.get(roomId);
    if (managed.game.phase === "round-complete") {
      await advanceLegacyRobotNextRound(runtime, roomId);
      return;
    }
    if (
      managed.game.phase !== "playing" ||
      !legacyTrickStarted(roomId, managed)
    ) {
      return;
    }

    const pending = pendingLegacyTricks.get(roomId);
    if (pending !== undefined) {
      const winner = managed.room.participants.find(
        ({ seat }) => seat === pending.winner,
      );
      if (winner?.kind !== "robot") return;

      // A robot won the completed trick. Perform the same collection action
      // that a human winner triggers with the end-round button, then resume.
      await sleep(1200);
      pendingLegacyTricks.delete(roomId);
      await runtime.websocket.broadcastGameState(runtime.rooms.get(roomId));
      continue;
    }

    const seat = managed.game.currentTurn;
    const participant = managed.room.participants.find(
      (candidate) => candidate.seat === seat,
    );
    if (participant?.kind !== "robot") return;

    await sleep(ROBOT_TURN_DELAY_MS);
    managed = runtime.rooms.get(roomId);
    if (
      managed.game.phase !== "playing" ||
      !legacyTrickStarted(roomId, managed) ||
      managed.game.currentTurn !== seat
    ) {
      continue;
    }

    const beforeCompletedTricks = managed.game.trick.completedTricks;
    const hand = managed.game.hands[seat] ?? [];
    let played = false;
    const candidates = robotCandidateCardIds(hand).sort(
      (left, right) =>
        robotCandidatePriority(managed.game, seat, left) -
        robotCandidatePriority(managed.game, seat, right),
    );
    for (const cardIds of candidates) {
      try {
        const next = runtime.rooms.play(roomId, seat, cardIds);
        await runtime.websocket.broadcastGameState(next);
        played = true;
        break;
      } catch {
        // Try the next legal Guandan pattern.
      }
    }

    if (!played) {
      managed = runtime.rooms.get(roomId);
      if (managed.game.phase !== "playing") return;
      if (managed.game.trick.leadingPlay === null) {
        throw new Error("robot has no legal opening play");
      }
      const next = runtime.rooms.pass(roomId, seat);
      await runtime.websocket.broadcastGameState(next);
    }

    if (await clearRobotWonTrick(runtime, roomId, beforeCompletedTricks)) {
      continue;
    }
  }
};

const startLegacyPlayWhenTributeComplete = async (
  runtime: ServerRuntime,
  roomId: string,
): Promise<boolean> => {
  if (hasPendingLegacyTribute(roomId)) return false;
  const managed = runtime.rooms.get(roomId);
  if (managed.game.phase !== "playing") return false;
  startedLegacyGames.add(roomId);
  await runtime.websocket.broadcastGameState(managed);
  await runLegacyRobots(runtime, roomId);
  return true;
};

const sendLegacy = async (
  socket: TextSocket,
  message: LegacyServerMessage,
): Promise<void> => {
  await socket.send(JSON.stringify(message));
};

const parseLegacyClientMessage = (raw: string): LegacyClientMessage => {
  const parsed = JSON.parse(raw) as Partial<LegacyClientMessage>;
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    typeof parsed.type !== "string"
  ) {
    throw new Error("legacy message must be an object with a type");
  }
  return parsed as LegacyClientMessage;
};

const legacyPlayerId = (name: string): string => {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error("player name is required");
  return `legacy:${normalized}`;
};

class LegacyAdapterSocket implements TextSocket {
  private roomState:
    | Extract<ServerMessage, { readonly type: "room_state" }>
    | undefined;
  private gameState:
    | Extract<ServerMessage, { readonly type: "game_state" }>
    | undefined;
  private startedRevision: number | undefined;
  private completedTricks = 0;
  private tablePlays: LegacyStateMessage["table_plays"] = [];
  readonly compat: {
    roomId: string;
    playerId: string;
    seat: number | null;
    privateCardIds: string[];
  };

  constructor(
    private readonly socket: TextSocket,
    initial: FrontendCompatState,
  ) {
    this.compat = {
      roomId: initial.roomId,
      playerId: initial.playerId,
      seat: initial.seat,
      privateCardIds: [...initial.privateCardIds],
    };
  }

  private async sendCurrentLegacyState(): Promise<void> {
    if (this.roomState === undefined || this.gameState === undefined) return;
    const legacyState = gameStateToLegacy(this.roomState, this.gameState);
    if (legacyState.type !== "state") return;
    const decoratedState = decorateLegacyTributeState(
      this.compat.roomId,
      legacyState,
    );
    const pending = pendingLegacyTricks.get(this.compat.roomId);
    await sendLegacy(this.socket, {
      ...decoratedState,
      last_play: pending?.lastPlay ?? decoratedState.last_play,
      last_player: pending?.winner ?? decoratedState.last_player,
      table_plays: pending?.tablePlays ?? this.tablePlays,
      passes: pending === undefined ? decoratedState.passes : 0,
      trick_complete: pending !== undefined,
      last_trick_winner: pending?.winner ?? null,
    });
  }

  async send(text: string): Promise<void> {
    const message = JSON.parse(text) as ServerMessage;
    switch (message.type) {
      case "room_state":
        {
          const nextSeat =
            message.participants.find(({ id }) => id === this.compat.playerId)
              ?.seat ?? null;
          if (nextSeat !== this.compat.seat) {
            this.compat.seat = nextSeat;
            if (nextSeat === null) this.compat.privateCardIds.splice(0);
            await sendLegacy(this.socket, {
              type: "joined",
              room: this.compat.roomId,
              seat: nextSeat,
            });
          }
        }
        this.roomState = message;
        await sendLegacy(this.socket, roomStateToLegacyWaiting(message));
        if (this.gameState?.phase === "round-complete") {
          await this.sendCurrentLegacyState();
        }
        return;
      case "private_hand":
        this.compat.privateCardIds.splice(
          0,
          this.compat.privateCardIds.length,
          ...message.cards.map(({ id }) => id),
        );
        await sendLegacy(this.socket, privateHandToLegacy(message));
        return;
      case "game_state": {
        const previousGameState = this.gameState;
        this.gameState = message;
        if (this.roomState === undefined) return;
        if (this.startedRevision === undefined) {
          this.startedRevision = message.revision;
          await sendLegacy(this.socket, {
            type: "started",
            player_count: message.handCounts.length,
            cards_per_player: message.handCounts[0] ?? 0,
          });
        }

        if (
          previousGameState !== undefined &&
          message.phase === "playing" &&
          message.completedTricks > this.completedTricks
        ) {
          const previousLegacy = gameStateToLegacy(
            this.roomState,
            previousGameState,
          );
          if (
            previousLegacy.type === "state" &&
            previousLegacy.last_player !== null &&
            previousLegacy.last_play.length > 0 &&
            this.tablePlays.length > 0 &&
            !pendingLegacyTricks.has(this.compat.roomId)
          ) {
            pendingLegacyTricks.set(this.compat.roomId, {
              completedTricks: message.completedTricks,
              winner: previousLegacy.last_player,
              lastPlay: previousLegacy.last_play,
              tablePlays: this.tablePlays,
            });
          }
        }

        if (
          message.phase === "round-complete" ||
          message.completedTricks < this.completedTricks
        ) {
          pendingLegacyTricks.delete(this.compat.roomId);
          this.tablePlays = [];
        }
        this.completedTricks = message.completedTricks;

        const legacyState = gameStateToLegacy(this.roomState, message);
        if (legacyState.type !== "state") return;
        const pending = pendingLegacyTricks.get(this.compat.roomId);
        const currentPlay = legacyState.table_plays[0];
        if (pending === undefined && currentPlay !== undefined) {
          this.tablePlays = [
            ...this.tablePlays.filter(
              ({ player }) => player !== currentPlay.player,
            ),
            currentPlay,
          ];
        } else if (
          pending === undefined &&
          currentPlay === undefined &&
          message.phase === "playing"
        ) {
          this.tablePlays = [];
        }

        await this.sendCurrentLegacyState();
        return;
      }
      case "error":
        await sendLegacy(this.socket, {
          type: "error",
          message: message.message,
        });
        return;
      case "pong":
        return;
    }
  }

  close(code?: number, reason?: string): void | Promise<void> {
    if (this.socket.close === undefined) return;
    return this.socket.close(code, reason);
  }
}

const supportedPlayerCount = (value: unknown): SupportedPlayerCount => {
  const count = Number(value);
  return count === 4 ||
    count === 6 ||
    count === 8 ||
    count === 10 ||
    count === 12 ||
    count === 14
    ? count
    : 4;
};

const ensureLegacyRoom = (
  runtime: ServerRuntime,
  roomId: string,
  requestedPlayerCount: unknown,
): void => {
  try {
    runtime.rooms.get(roomId);
  } catch {
    runtime.rooms.create(roomId, supportedPlayerCount(requestedPlayerCount));
  }
};

const firstAvailableSeat = (
  managed: ReturnType<ServerRuntime["rooms"]["get"]>,
): number => {
  const occupied = new Set(managed.room.participants.map(({ seat }) => seat));
  for (let seat = 0; seat < managed.room.config.playerCount; seat += 1) {
    if (!occupied.has(seat)) return seat;
  }
  return managed.room.participants.length;
};

const requestedLegacySeat = (
  message: LegacyClientMessage,
  playerCount: number,
): number | undefined => {
  const raw = (
    message as LegacyClientMessage & { readonly desired_seat?: unknown }
  ).desired_seat;
  if (raw === undefined) return undefined;
  const seat = Number(raw);
  if (!Number.isInteger(seat) || seat < 0 || seat >= playerCount) {
    throw new Error("requested player seat is out of range");
  }
  return seat;
};

const reclaimStaleLobbyHumans = (
  runtime: ServerRuntime,
  roomId: string,
  preservePlayerId: string,
): ReturnType<ServerRuntime["rooms"]["get"]> => {
  let managed = runtime.rooms.get(roomId);
  if (managed.game.phase !== "lobby") return managed;

  const staleIds = managed.room.participants
    .filter(
      ({ id, kind, connected }) =>
        kind === "human" &&
        id !== preservePlayerId &&
        !connected &&
        runtime.sockets.playerConnectionCount(roomId, id) === 0,
    )
    .map(({ id }) => id);

  if (staleIds.length === 0) return managed;

  let room = managed.room;
  for (const id of staleIds) room = removeParticipant(room, id);
  managed = runtime.rooms.set(roomId, { ...managed, room });
  return managed;
};

export const assertLegacyNextRoundRole = (
  message: LegacyClientMessage,
  seat: number | null,
  game: Extract<ServerMessage, { readonly type: "game_state" }>,
): void => {
  if (
    message.type !== "shuffle_next_round" &&
    message.type !== "deal_next_round"
  ) {
    return;
  }
  if (seat === null) throw new Error("a seated player is required");
  if (game.phase !== "round-complete") {
    throw new Error("round is not complete");
  }
  const winner = game.finishedSeats[0];
  if (winner === undefined) throw new Error("previous winner is unavailable");

  if (message.type === "shuffle_next_round" && seat % 2 === winner % 2) {
    throw new Error("only the losing team may shuffle for the next round");
  }
  if (message.type === "deal_next_round" && seat !== winner) {
    throw new Error("only the previous winner may deal the next round");
  }
};

export const attachLegacyGuandanConnection = async (
  runtime: ServerRuntime,
  connection: UpgradedConnection,
): Promise<void> => {
  await sendLegacy(connection.socket, {
    type: "connected",
    protocol: "yihua-cleanroom-guandan-v1",
  });

  let active:
    | {
        roomId: string;
        playerId: string;
        adapter: LegacyAdapterSocket;
      }
    | undefined;

  connection.onClose(async () => {
    if (active === undefined) return;
    const closed = active;
    runtime.sockets.unregister(closed.roomId, closed.adapter);
    if (
      runtime.sockets.playerConnectionCount(closed.roomId, closed.playerId) > 0
    ) {
      return;
    }
    try {
      const managed = runtime.rooms.get(closed.roomId);
      const isObserver = managed.room.observers.some(
        ({ id }) => id === closed.playerId,
      );
      const next = runtime.rooms.set(closed.roomId, {
        ...managed,
        room: isObserver
          ? managed.game.phase === "lobby"
            ? removeObserver(managed.room, closed.playerId)
            : disconnectObserver(managed.room, closed.playerId)
          : managed.game.phase === "lobby"
            ? removeParticipant(managed.room, closed.playerId)
            : disconnectHuman(managed.room, closed.playerId),
      });
      await runtime.websocket.broadcastRoomState(next);
    } catch {
      // Room may have been removed while the socket was closing.
    }
  });

  connection.onText(async (raw) => {
    try {
      const message = parseLegacyClientMessage(raw);
      if (message.type === "join") {
        if (active !== undefined) {
          throw new Error("connection already joined a room");
        }
        const requestedRoomId =
          connection.context.roomId === LEGACY_PENDING_ROOM
            ? message.room
            : connection.context.roomId;
        const roomId = requestedRoomId.trim();
        if (roomId.length === 0) throw new Error("room id is required");
        const playerId = legacyPlayerId(message.name);
        const requestedPlayerCount = (
          message as LegacyClientMessage & { readonly player_count?: number }
        ).player_count;
        ensureLegacyRoom(runtime, roomId, requestedPlayerCount);

        let managed = reclaimStaleLobbyHumans(runtime, roomId, playerId);
        const existing = managed.room.participants.find(
          ({ id, kind }) => id === playerId && kind === "human",
        );
        const existingObserver = managed.room.observers.find(
          ({ id }) => id === playerId,
        );
        const desiredSeat = requestedLegacySeat(
          message,
          managed.room.config.playerCount,
        );
        const desiredOccupant =
          desiredSeat === undefined
            ? undefined
            : managed.room.participants.find(
                ({ seat }) => seat === desiredSeat,
              );
        if (
          existing === undefined &&
          managed.game.phase === "lobby" &&
          desiredOccupant !== undefined &&
          desiredOccupant.kind === "human"
        ) {
          throw new Error("requested player seat is already occupied");
        }
        const robotSeat =
          desiredSeat !== undefined && desiredOccupant?.kind === "robot"
            ? desiredSeat
            : [...managed.room.participants]
                .filter(({ kind }) => kind === "robot")
                .sort((a, b) => a.seat - b.seat)[0]?.seat;
        const joinsAsObserver =
          existingObserver !== undefined ||
          (existing === undefined && managed.game.phase !== "lobby");
        const seat = joinsAsObserver
          ? null
          : (existing?.seat ??
            desiredSeat ??
            robotSeat ??
            firstAvailableSeat(managed));
        const adapter = new LegacyAdapterSocket(connection.socket, {
          roomId,
          playerId,
          seat,
          privateCardIds: [],
        });

        try {
          runtime.sockets.register(roomId, adapter, playerId);
          if (existing !== undefined) {
            if (!existing.connected) {
              managed = runtime.rooms.set(roomId, {
                ...managed,
                room: reconnectHuman(managed.room, playerId),
              });
              await runtime.websocket.broadcastRoomState(managed);
            }
          } else if (existingObserver !== undefined) {
            if (!existingObserver.connected) {
              managed = runtime.rooms.set(roomId, {
                ...managed,
                room: reconnectObserver(managed.room, playerId),
              });
              await runtime.websocket.broadcastRoomState(managed);
            }
          } else if (joinsAsObserver) {
            managed = runtime.rooms.set(roomId, {
              ...managed,
              room: addObserver(managed.room, {
                id: playerId,
                name: message.name,
              }),
            });
            await runtime.websocket.broadcastRoomState(managed);
          } else if (robotSeat !== undefined && robotSeat === seat) {
            managed = runtime.rooms.set(roomId, {
              ...managed,
              room: replaceRobotWithHuman(managed.room, {
                id: playerId,
                name: message.name,
                seat: robotSeat,
              }),
            });
            await runtime.websocket.broadcastRoomState(managed);
          } else {
            await runtime.websocket.handleText(
              adapter,
              { roomId, playerId },
              JSON.stringify({
                type: "join_room",
                roomId,
                playerId,
                name: message.name,
                seat,
              }),
            );
            const joined = runtime.rooms
              .get(roomId)
              .room.participants.some(
                ({ id, kind }) => id === playerId && kind === "human",
              );
            if (!joined) {
              runtime.sockets.unregister(roomId, adapter);
              return;
            }
          }
        } catch (error) {
          runtime.sockets.unregister(roomId, adapter);
          throw error;
        }

        active = { roomId, playerId, adapter };
        await sendLegacy(connection.socket, {
          type: "joined",
          room: roomId,
          seat,
        });
        await runtime.websocket.sendSnapshot(adapter, roomId, playerId);
        return;
      }

      if (active === undefined) {
        throw new Error("join is required before game commands");
      }

      if (message.type === "move_seat") {
        const managed = runtime.rooms.get(active.roomId);
        if (managed.game.phase !== "lobby") {
          throw new Error(
            "seat movement is only available before the first round",
          );
        }
        const next = runtime.rooms.set(active.roomId, {
          ...managed,
          room: moveParticipantSeat(
            managed.room,
            active.playerId,
            message.direction,
          ),
        });
        await runtime.websocket.broadcastRoomState(next);
        return;
      }

      if (message.type === "reorder_players") {
        const managed = runtime.rooms.get(active.roomId);
        if (managed.game.phase !== "lobby") {
          throw new Error(
            "partners can only be selected before the first round",
          );
        }
        const partner = managed.room.participants.find(
          ({ seat, kind }) => seat === message.order[1] && kind === "human",
        );
        if (partner === undefined)
          throw new Error("selected partner is unavailable");
        const next = runtime.rooms.set(active.roomId, {
          ...managed,
          room: choosePartner(managed.room, active.playerId, partner.id),
        });
        await runtime.websocket.broadcastRoomState(next);
        return;
      }

      if (message.type === "set_participation") {
        const managed = runtime.rooms.get(active.roomId);
        if (managed.game.phase === "lobby") {
          throw new Error(
            "participation changes are available after play begins",
          );
        }
        const preferredPartner =
          message.preferred_partner === undefined
            ? undefined
            : managed.room.participants.find(
                ({ name, kind }) =>
                  name === message.preferred_partner && kind === "human",
              );
        const next = runtime.rooms.set(active.roomId, {
          ...managed,
          room: setParticipationForNextRound(
            managed.room,
            active.playerId,
            message.active,
            preferredPartner?.id,
          ),
        });
        await runtime.websocket.broadcastRoomState(next);
        await runtime.websocket.broadcastGameState(next);
        await advanceLegacyRobotNextRound(runtime, active.roomId);
        return;
      }

      if (message.type === "start_trick") {
        const managed = runtime.rooms.get(active.roomId);
        if (managed.game.phase !== "playing") {
          throw new Error("现在不能开始本轮");
        }
        if (pendingLegacyTricks.has(active.roomId)) {
          throw new Error("请先结束本轮并收牌");
        }
        if (managed.game.trick.leadingPlay !== null) {
          return;
        }
        startedLegacyGames.add(active.roomId);
        await runtime.websocket.broadcastGameState(managed);
        await runLegacyRobots(runtime, active.roomId);
        return;
      }

      if (message.type === "end_round") {
        const pending = pendingLegacyTricks.get(active.roomId);
        if (
          pending !== undefined &&
          active.adapter.compat.seat !== pending.winner
        ) {
          throw new Error(
            "only the completed trick winner may clear the table",
          );
        }
        pendingLegacyTricks.delete(active.roomId);
        await runtime.websocket.broadcastGameState(
          runtime.rooms.get(active.roomId),
        );
        await runLegacyRobots(runtime, active.roomId);
        return;
      }
      if (
        message.type === "shuffle_next_round" ||
        message.type === "deal_next_round"
      ) {
        const managed = runtime.rooms.get(active.roomId);
        if (managed.game.phase !== "round-complete") {
          throw new Error("round is not complete");
        }
        const finalDraw = managed.game.openingDraw.attempts.at(-1);
        if (finalDraw === undefined) throw new Error("opening draw is missing");
        assertLegacyNextRoundRole(message, active.adapter.compat.seat, {
          type: "game_state",
          roomId: active.roomId,
          revision: managed.revision,
          phase: "round-complete",
          currentTurn: managed.game.currentTurn,
          handCounts: managed.game.hands.map((hand) => hand.length),
          openingDraw: finalDraw.cards.map(({ card }) => card),
          openingDrawWinner: managed.game.openingDraw.winnerSeat,
          leadingPlay:
            managed.game.trick.leadingPlay === null
              ? null
              : {
                  seat: managed.game.trick.leadingPlay.seat,
                  cards: managed.game.trick.leadingPlay.cards,
                },
          passedSeats: managed.game.trick.passedSeats,
          finishedSeats: managed.game.finishedSeats,
          completedTricks: managed.game.trick.completedTricks,
        });
        if (message.type === "deal_next_round") {
          prepareLegacyTribute(active.roomId, managed.game.finishedSeats);
        }
      }

      if (
        message.type === "tribute_card" ||
        message.type === "return_tribute"
      ) {
        const seat = active.adapter.compat.seat;
        if (seat === null) throw new Error("a seated player is required");
        const cardId = active.adapter.compat.privateCardIds[message.card_index];
        if (cardId === undefined)
          throw new Error("selected tribute card is out of range");
        await applyLegacyTributeSelection(
          runtime,
          active.roomId,
          seat,
          cardId,
          message.type,
        );
        await runLegacyRobotTribute(runtime, active.roomId);
        await startLegacyPlayWhenTributeComplete(runtime, active.roomId);
        return;
      }

      if (
        hasPendingLegacyTribute(active.roomId) &&
        (message.type === "play" || message.type === "pass")
      ) {
        throw new Error("complete tribute and return tribute before playing");
      }

      if (message.type === "play" || message.type === "pass") {
        const managed = runtime.rooms.get(active.roomId);
        if (
          managed.game.phase === "playing" &&
          managed.game.trick.leadingPlay === null &&
          !legacyTrickStarted(active.roomId, managed)
        ) {
          throw new Error("请先点击“开始”，再出牌");
        }
      }

      const clean = toCleanroomCommand(message, active.adapter.compat);
      await runtime.websocket.handleText(
        active.adapter,
        { roomId: active.roomId, playerId: active.playerId },
        JSON.stringify(clean),
      );

      if (message.type === "start" || message.type === "deal_next_round") {
        startedLegacyGames.delete(active.roomId);
      }

      if (message.type === "play" || message.type === "pass") {
        await runLegacyRobots(runtime, active.roomId);
      }

      if (message.type === "shuffle_next_round") {
        await advanceLegacyRobotNextRound(runtime, active.roomId);
      }

      if (message.type === "deal_next_round") {
        const managed = runtime.rooms.get(active.roomId);
        if (resolveLegacyTributeResistance(active.roomId, managed)) {
          await runtime.websocket.broadcastGameState(managed);
        } else {
          await runLegacyRobotTribute(runtime, active.roomId);
        }
        await startLegacyPlayWhenTributeComplete(runtime, active.roomId);
      }
    } catch (error) {
      await sendLegacy(connection.socket, {
        type: "error",
        message:
          error instanceof Error ? error.message : "invalid legacy message",
      });
    }
  });
};
