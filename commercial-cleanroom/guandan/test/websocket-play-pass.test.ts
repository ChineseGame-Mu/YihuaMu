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
  private closeHandler: (() => void | Promise<void>) | undefined;

  constructor(readonly context: ConnectionContext) {}

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(handler: () => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  async receive(text: string): Promise<void> {
    await this.textHandler?.(text);
  }
}

const deterministicRandom = (): (() => number) => {
  let state = 0x31415926;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("websocket play and pass commands", () => {
  it("plays exact card ids and deduplicates play/pass retries", async () => {
    const runtime = createServerRuntime();
    let managed = runtime.rooms.create("live-play", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = runtime.rooms.set("live-play", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = runtime.rooms.start("live-play", deterministicRandom());
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const leaderSeat = started.game.currentTurn;
    const leader = started.room.participants.find(
      ({ seat }) => seat === leaderSeat,
    );
    expect(leader?.kind).toBe("human");
    if (!leader || leader.kind !== "human") return;

    const leaderConnection = new FakeConnection({
      roomId: "live-play",
      playerId: leader.id,
    });
    await attachUpgradedConnection(runtime, leaderConnection);
    const bystander = started.room.participants.find(
      ({ id, kind }) => kind === "human" && id !== leader.id,
    );
    expect(bystander?.kind).toBe("human");
    if (!bystander || bystander.kind !== "human") return;
    const bystanderSocket = new RecordingSocket();
    runtime.sockets.register("live-play", bystanderSocket, bystander.id);

    const selected = started.game.hands[leaderSeat]?.[0];
    expect(selected).toBeDefined();
    if (!selected) return;

    const revisionBeforePlay = runtime.rooms.get("live-play").revision;
    const handCountBeforePlay = started.game.hands[leaderSeat]?.length ?? 0;
    const playCommand = JSON.stringify({
      type: "play_cards",
      cardIds: [selected.id],
      expectedRevision: revisionBeforePlay,
      commandId: "play-once",
    });

    const leaderPrivateHandsBefore = leaderConnection.socket.sent.filter(
      (text) => JSON.parse(text).type === "private_hand",
    ).length;
    await leaderConnection.receive(playCommand);
    const afterPlay = runtime.rooms.get("live-play");
    expect(afterPlay.revision).toBe(revisionBeforePlay + 1);
    expect(afterPlay.game.phase).toBe("playing");
    if (afterPlay.game.phase !== "playing") return;
    expect(afterPlay.game.hands[leaderSeat]?.length).toBe(
      handCountBeforePlay - 1,
    );
    expect(
      afterPlay.game.hands[leaderSeat]?.some(({ id }) => id === selected.id),
    ).toBe(false);
    expect(afterPlay.game.trick.leadingPlay).toMatchObject({
      seat: leaderSeat,
      cards: [selected.card],
    });
    expect(
      leaderConnection.socket.sent.filter(
        (text) => JSON.parse(text).type === "private_hand",
      ),
    ).toHaveLength(leaderPrivateHandsBefore + 1);
    expect(bystanderSocket.sent.map((text) => JSON.parse(text).type)).toContain(
      "game_state",
    );
    expect(
      bystanderSocket.sent.map((text) => JSON.parse(text).type),
    ).not.toContain("private_hand");

    await leaderConnection.receive(playCommand);
    const afterPlayRetry = runtime.rooms.get("live-play");
    expect(afterPlayRetry.revision).toBe(afterPlay.revision);
    expect(afterPlayRetry.game.phase).toBe("playing");
    if (afterPlayRetry.game.phase !== "playing") return;
    expect(afterPlayRetry.game.hands[leaderSeat]?.length).toBe(
      handCountBeforePlay - 1,
    );

    const responderSeat = afterPlayRetry.game.currentTurn;
    const responder = afterPlayRetry.room.participants.find(
      ({ seat }) => seat === responderSeat,
    );
    expect(responder?.kind).toBe("human");
    if (!responder || responder.kind !== "human") return;

    const responderConnection = new FakeConnection({
      roomId: "live-play",
      playerId: responder.id,
    });
    await attachUpgradedConnection(runtime, responderConnection);
    const revisionBeforePass = runtime.rooms.get("live-play").revision;
    const passCommand = JSON.stringify({
      type: "pass_turn",
      expectedRevision: revisionBeforePass,
      commandId: "pass-once",
    });

    await responderConnection.receive(passCommand);
    const afterPass = runtime.rooms.get("live-play");
    expect(afterPass.revision).toBe(revisionBeforePass + 1);
    expect(afterPass.game.phase).toBe("playing");
    if (afterPass.game.phase !== "playing") return;
    expect(afterPass.game.trick.passedSeats).toContain(responderSeat);

    await responderConnection.receive(passCommand);
    expect(runtime.rooms.get("live-play").revision).toBe(afterPass.revision);
  });
});
