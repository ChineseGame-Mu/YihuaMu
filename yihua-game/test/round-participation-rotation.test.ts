import { describe, expect, it } from "vitest";

import {
  addHuman,
  addObserver,
  applyNextRoundParticipation,
  choosePartner,
  createRoom,
  setParticipationForNextRound,
  setRobotCount,
} from "../src/core/room.js";

describe("round-boundary participation rotation", () => {
  it("keeps a late arrival observing until the next round then takes a robot seat beside the chosen partner", () => {
    let room = addHuman(createRoom("late-observer", 4), {
      id: "p1",
      name: "玩家1",
      seat: 0,
    });
    room = setRobotCount(room, 3);
    room = addObserver(room, { id: "late", name: "后来者" });

    expect(room.participants.some(({ id }) => id === "late")).toBe(false);
    expect(room.observers.map(({ name }) => name)).toEqual(["后来者"]);

    room = setParticipationForNextRound(room, "late", true, "p1");
    room = applyNextRoundParticipation(room);

    const late = room.participants.find(({ id }) => id === "late");
    if (late === undefined) throw new Error("late participant expected");
    expect(late?.kind).toBe("human");
    expect(late.seat % 2).toBe(0);
    expect(room.observers).toEqual([]);
    expect(room.config.botCount).toBe(2);
  });

  it("moves a departing player to the observer list and fills the exact seat with a robot", () => {
    let room = createRoom("player-exit", 4);
    for (let seat = 0; seat < 4; seat += 1) {
      room = addHuman(room, {
        id: `p${seat + 1}`,
        name: `玩家${seat + 1}`,
        seat,
      });
    }

    room = setParticipationForNextRound(room, "p3", false);
    expect(
      room.participants.find(({ id }) => id === "p3")?.leavingAfterRound,
    ).toBe(true);

    room = applyNextRoundParticipation(room);

    expect(room.participants.find(({ seat }) => seat === 2)?.kind).toBe(
      "robot",
    );
    expect(room.observers.find(({ id }) => id === "p3")?.name).toBe("玩家3");
    expect(room.config.botCount).toBe(1);
    expect(room.participants).toHaveLength(4);
  });

  it("lets a seated player choose a human partner before the first round", () => {
    let room = createRoom("partner-choice", 4);
    for (let seat = 0; seat < 4; seat += 1) {
      room = addHuman(room, {
        id: `p${seat + 1}`,
        name: `玩家${seat + 1}`,
        seat,
      });
    }

    room = choosePartner(room, "p1", "p2");
    const player = room.participants.find(({ id }) => id === "p1")!;
    const partner = room.participants.find(({ id }) => id === "p2")!;
    expect(player.seat % 2).toBe(partner.seat % 2);
    expect(new Set(room.participants.map(({ seat }) => seat)).size).toBe(4);
  });

  it("supports cancelling both a queued observer entry and a queued player exit", () => {
    let room = addHuman(createRoom("cancel", 4), {
      id: "p1",
      name: "玩家1",
      seat: 0,
    });
    room = setRobotCount(room, 3);
    room = addObserver(room, { id: "late", name: "后来者" });
    room = setParticipationForNextRound(room, "late", true, "p1");
    room = setParticipationForNextRound(room, "late", false);
    room = setParticipationForNextRound(room, "p1", false);
    room = setParticipationForNextRound(room, "p1", true);

    const next = applyNextRoundParticipation(room);
    expect(
      next.observers.find(({ id }) => id === "late")?.readyForNextRound,
    ).toBe(false);
    expect(next.participants.find(({ id }) => id === "p1")?.kind).toBe("human");
    expect(next.config.botCount).toBe(3);
  });

  it("replaces multiple departing players even when the table needs more than three robots", () => {
    let room = createRoom("multi-exit", 6);
    for (let seat = 0; seat < 6; seat += 1) {
      room = addHuman(room, {
        id: `p${seat + 1}`,
        name: `玩家${seat + 1}`,
        seat,
      });
    }
    for (const playerId of ["p3", "p4", "p5", "p6"]) {
      room = setParticipationForNextRound(room, playerId, false);
    }

    room = applyNextRoundParticipation(room);

    expect(
      room.participants.filter(({ kind }) => kind === "robot"),
    ).toHaveLength(4);
    expect(room.observers).toHaveLength(4);
    expect(room.config.botCount).toBe(4);
  });
});
