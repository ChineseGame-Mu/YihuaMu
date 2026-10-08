import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addPlayerSessionToJoin,
  cleanroomDeploymentRoom,
  readPlayerSession,
  storePlayerSession,
  withGuandanJoinCredentials,
  isRecoverablePlayerSessionError,
  sendGuandanLeave,
  shouldCoalesceGuandanServerMessage,
} from "./GuandanWebsocketProvider";

describe("Guandan server message queue", () => {
  test("never coalesces state transitions that clear and replace table cards", () => {
    expect(shouldCoalesceGuandanServerMessage({ type: "state" })).toBe(false);
  });

  test("still coalesces replaceable lobby and private-hand snapshots", () => {
    expect(shouldCoalesceGuandanServerMessage({ type: "waiting" })).toBe(true);
    expect(shouldCoalesceGuandanServerMessage({ type: "hand" })).toBe(true);
  });
});

describe("cleanroom deployment room isolation", () => {
  test("isolates the same visible room across immutable Vercel deployments", () => {
    const a = cleanroomDeploymentRoom("0004", "yihua-lespj0j5h-chinese-game.vercel.app");
    const b = cleanroomDeploymentRoom("0004", "yihua-4txtp2xs5-chinese-game.vercel.app");
    expect(a).not.toBe(b);
    expect(a).toContain("0004");
    expect(b).toContain("0004");
  });

  test("keeps local/non-Vercel room ids unchanged", () => {
    expect(cleanroomDeploymentRoom("0004", "localhost")).toBe("0004");
    expect(cleanroomDeploymentRoom("0002", "example.com")).toBe("0002");
  });

  test("keeps production room ids stable across deployments", () => {
    expect(cleanroomDeploymentRoom("0004", "yihua-mu.vercel.app")).toBe(
      "0004",
    );
  });

  test("rejects an empty visible room", () => {
    expect(cleanroomDeploymentRoom(null, "yihua-example.vercel.app")).toBeNull();
    expect(cleanroomDeploymentRoom("   ", "yihua-example.vercel.app")).toBeNull();
  });
});

describe("cleanroom player-session reconnect", () => {
  test("recognizes a stale room-bound session as recoverable", () => {
    expect(
      isRecoverablePlayerSessionError(
        "player session no longer belongs to this room",
      ),
    ).toBe(true);
    expect(isRecoverablePlayerSessionError("resume token is required")).toBe(
      false,
    );
    expect(
      isRecoverablePlayerSessionError("player session is invalid or expired"),
    ).toBe(false);
  });

  test("adds a stored player id and resume token to the join message body", () => {
    expect(
      addPlayerSessionToJoin(
        { type: "join", room: "0004", name: "玩家一", player_count: 6 },
        { playerId: "legacy:玩家一", resumeToken: "signed-token" },
      ),
    ).toEqual({
      type: "join",
      room: "0004",
      name: "玩家一",
      player_count: 6,
      player_id: "legacy:玩家一",
      resume_token: "signed-token",
    });
  });

  test("does not add empty credentials to a first-time join", () => {
    const join = { type: "join" as const, room: "0004", name: "玩家一" };
    expect(addPlayerSessionToJoin(join, null)).toBe(join);
  });

  test("recovers a signed session from persistent storage after a new tab", () => {
    const fakeStorage = () => {
      const data = new Map<string, string>();
      return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
        clear: () => data.clear(),
      };
    };
    const previousWindow = (globalThis as any).window;
    (globalThis as any).window = {
      sessionStorage: fakeStorage(),
      localStorage: fakeStorage(),
    };
    try {
      const session = { playerId: "legacy:玩家一", resumeToken: "signed-token" };
      storePlayerSession("0004", "玩家一", session);
      expect(readPlayerSession("0004", "玩家一")).toEqual(session);
      window.sessionStorage.clear();
      expect(readPlayerSession("0004", "玩家一")).toEqual(session);
      expect(readPlayerSession("0004", "另一位")).toBeNull();
    } finally {
      if (previousWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = previousWindow;
    }
  });

  test("prioritizes a pasted recovery code over stale browser credentials", () => {
    const join = {
      type: "join" as const,
      room: "0004",
      name: "玩家一",
      resume_token: "copied-from-original-browser",
    };
    expect(
      withGuandanJoinCredentials(join, {
        playerId: "legacy:old",
        resumeToken: "stale",
      }),
    ).toEqual(join);
  });
});

describe("cleanroom room departure", () => {
  test("sends an explicit leave before navigating away", () => {
    const send = jest.fn();
    expect(
      sendGuandanLeave({ readyState: WebSocket.OPEN, send }, true),
    ).toBe(true);
    expect(send).toHaveBeenCalledWith('{"type":"leave"}');
  });

  test("does not emit leave for a socket that never joined or is already closed", () => {
    const send = jest.fn();
    expect(
      sendGuandanLeave({ readyState: WebSocket.OPEN, send }, false),
    ).toBe(false);
    expect(
      sendGuandanLeave({ readyState: WebSocket.CLOSED, send }, true),
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});


describe("disconnect seat reservation regression", () => {
  test("does not release a seat on page suspension or provider cleanup", () => {
    const source = readFileSync(
      join(__dirname, "GuandanWebsocketProvider.tsx"),
      "utf8",
    );
    expect(source).not.toContain('addEventListener("pagehide", leave)');
    expect(source).not.toContain('removeEventListener("pagehide", leave)');
    expect(source).not.toMatch(
      /return \\(\\) => \\{[\\s\\S]*?\\n\\s*leave\\(\\);[\\s\\S]*?\\n\\s*\\};/,
    );
  });
});
