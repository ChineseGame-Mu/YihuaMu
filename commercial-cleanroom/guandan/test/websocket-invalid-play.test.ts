import { describe, expect, it } from "vitest";

import { addHuman } from "../src/core/room.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type {
  ConnectionContext,
  TextSocket,
} from "../src/core/websocket-service.js";
import {
  attachUpgradedConnection,
  type UpgradedConnection,
} from "../src/core/websocket-upgrade.js";

class RecordingSocket implements TextSocket {
  readonly sent: string[] = [];

  send(text: string): void {
    this.sent.push(text);
  }
}

class FakeConnection implements UpgradedConnection {
  readonly socket = new RecordingSocket();
  private textHandler: ((text: string) => void | Promise<void>) | undefined;

  constructor(readonly context: ConnectionContext) {}

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(_handler: () => void | Promise<void>): void {}

  async receive(text: string): Promise<void> {
    await this.textHandler?.(text);
  }
}

const deterministicRandom = (): (() => number) => {
  let state = 0x27182818;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("invalid websocket play commands", () => {
  it("keeps state unchanged for bad ids, wrong turn, and stale revisions", async () => {
    const runtime = createServerRuntime();
    let managed = runtime.rooms.create("invalid-play", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = runtime.rooms.set("invalid-play", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = runtime.rooms.start("invalid-play", deterministicRandom());
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const leaderSeat = started.game.currentTurn;
    const leader = started.room.participants.find(
      ({ seat }) => seat === leaderSeat,
    );
    if (!leader || leader.kind !== "human") return;
    const leaderConnection = new FakeConnection({
      roomId: "invalid-play",
      playerId: leader.id,
    });
    await attachUpgradedConnection(runtime, leaderConnection);

    const initialRevision = runtime.rooms.get("invalid-play").revision;
    const initialLeaderIds = started.game.hands[leaderSeat]!.map(
      ({ id }) => id,
    );

    await leaderConnection.receive(
      JSON.stringify({
        type: "play_cards",
        cardIds: ["missing-card-id"],
        expectedRevision: initialRevision,
        commandId: "bad-card-id",
      }),
    );

    const afterBadId = runtime.rooms.get("invalid-play");
    expect(afterBadId.revision).toBe(initialRevision);
    expect(afterBadId.game.phase).toBe("playing");
    if (afterBadId.game.phase !== "playing") return;
    expect(afterBadId.game.hands[leaderSeat]!.map(({ id }) => id)).toEqual(
      initialLeaderIds,
    );
    expect(
      JSON.parse(leaderConnection.socket.sent.at(-1) ?? "{}"),
    ).toMatchObject({
      type: "error",
      code: "invalid_message",
    });

    const wrongSeat = (leaderSeat + 1) % 4;
    const wrongPlayer = started.room.participants.find(
      ({ seat }) => seat === wrongSeat,
    );
    if (!wrongPlayer || wrongPlayer.kind !== "human") return;
    const wrongConnection = new FakeConnection({
      roomId: "invalid-play",
      playerId: wrongPlayer.id,
    });
    await attachUpgradedConnection(runtime, wrongConnection);
    const wrongCard = afterBadId.game.hands[wrongSeat]?.[0];
    if (!wrongCard) return;
    const wrongHandIds = afterBadId.game.hands[wrongSeat]!.map(({ id }) => id);

    await wrongConnection.receive(
      JSON.stringify({
        type: "play_cards",
        cardIds: [wrongCard.id],
        expectedRevision: initialRevision,
        commandId: "wrong-turn",
      }),
    );

    const afterWrongTurn = runtime.rooms.get("invalid-play");
    expect(afterWrongTurn.revision).toBe(initialRevision);
    expect(afterWrongTurn.game.phase).toBe("playing");
    if (afterWrongTurn.game.phase !== "playing") return;
    expect(afterWrongTurn.game.hands[wrongSeat]!.map(({ id }) => id)).toEqual(
      wrongHandIds,
    );

    const leaderCard = afterWrongTurn.game.hands[leaderSeat]?.[0];
    if (!leaderCard) return;
    await leaderConnection.receive(
      JSON.stringify({
        type: "play_cards",
        cardIds: [leaderCard.id],
        expectedRevision: initialRevision,
        commandId: "valid-lead",
      }),
    );

    const afterValidPlay = runtime.rooms.get("invalid-play");
    expect(afterValidPlay.revision).toBe(initialRevision + 1);
    expect(afterValidPlay.game.phase).toBe("playing");
    if (afterValidPlay.game.phase !== "playing") return;

    const responderSeat = afterValidPlay.game.currentTurn;
    const responder = afterValidPlay.room.participants.find(
      ({ seat }) => seat === responderSeat,
    );
    if (!responder || responder.kind !== "human") return;
    const responderConnection = new FakeConnection({
      roomId: "invalid-play",
      playerId: responder.id,
    });
    await attachUpgradedConnection(runtime, responderConnection);
    const responderCard = afterValidPlay.game.hands[responderSeat]?.[0];
    if (!responderCard) return;
    const responderIds = afterValidPlay.game.hands[responderSeat]!.map(
      ({ id }) => id,
    );

    await responderConnection.receive(
      JSON.stringify({
        type: "play_cards",
        cardIds: [responderCard.id],
        expectedRevision: initialRevision,
        commandId: "stale-play",
      }),
    );

    const afterStalePlay = runtime.rooms.get("invalid-play");
    expect(afterStalePlay.revision).toBe(afterValidPlay.revision);
    expect(afterStalePlay.game.phase).toBe("playing");
    if (afterStalePlay.game.phase !== "playing") return;
    expect(
      afterStalePlay.game.hands[responderSeat]!.map(({ id }) => id),
    ).toEqual(responderIds);
    expect(
      JSON.parse(responderConnection.socket.sent.at(-1) ?? "{}"),
    ).toMatchObject({ type: "error", code: "stale_revision" });
  });
});
