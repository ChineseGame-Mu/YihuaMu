import { describe, expect, it } from "vitest";

import { renderTablePage } from "../src/core/table-page.js";

describe("playable table frontend/backend connection", () => {
  it("routes the browser through the room WebSocket and all gameplay commands", () => {
    const html = renderTablePage("manual test/一号");

    expect(html).toContain(
      'new WebSocket(scheme + "//" + location.host + "/ws/rooms/manual%20test%2F%E4%B8%80%E5%8F%B7?playerId=" + encodeURIComponent(playerId))',
    );
    expect(html).toContain('send({ type:"start_game" })');
    expect(html).toContain(
      'send({ type:"play_cards", cardIds:[...selected] })',
    );
    expect(html).toContain('send({ type:"pass_turn" })');
    expect(html).toContain('send({ type:"next_round" })');
    expect(html).toContain(
      'send({ type:"set_next_round_ready", ready:true })',
    );
    expect(html).toContain(
      'send({ type:"set_next_round_ready", ready:false })',
    );
  });

  it("renders live backend room, game and private-hand messages", () => {
    const html = renderTablePage("manual-test");

    expect(html).toContain('message.type === "room_state"');
    expect(html).toContain('message.type === "game_state"');
    expect(html).toContain('message.type === "private_hand"');
    expect(html).toContain('message.type === "error"');
    expect(html).toContain("latestGameState.revision");
    expect(html).toContain("latestGameState.handCounts.length");
  });
});
