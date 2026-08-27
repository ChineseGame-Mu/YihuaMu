const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderTablePage = (roomId: string): string => {
  const safeRoomId = escapeHtml(roomId);
  const encodedRoomId = encodeURIComponent(roomId);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>牌室 ${safeRoomId}</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: 24px; background: linear-gradient(145deg,#e9f5ec,#d5eadc); color: #173d29; }
    .table-shell { width: min(100%, 720px); margin: 0 auto; }
    .table-card { background: rgba(255,255,255,.96); border: 1px solid rgba(23,61,41,.12); border-radius: 24px; padding: 26px; box-shadow: 0 20px 55px rgba(23,61,41,.12); }
    h1 { margin: 0; font-size: 28px; }
    .sub { margin: 8px 0 22px; color: #5b7564; }
    .status { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: #edf7f0; color: #245c3a; font-weight: 700; }
    .players { display: grid; gap: 10px; margin-top: 20px; }
    .player { display: flex; justify-content: space-between; align-items: center; min-height: 48px; padding: 10px 14px; border-radius: 14px; background: #f4f8f5; }
    .player.me { outline: 2px solid #63a57b; background: #eef8f1; }
    .seat { color: #6d7d72; font-size: 14px; }
    .empty { color: #8a988f; }
  </style>
</head>
<body>
  <main class="table-shell">
    <section class="table-card">
      <h1>已进入牌室</h1>
      <p class="sub">房间：${safeRoomId}</p>
      <div id="status" class="status">正在连接牌桌…</div>
      <div id="players" class="players"></div>
    </section>
  </main>
  <script>
    (() => {
      const roomId = decodeURIComponent("${encodedRoomId}");
      const playerId = new URLSearchParams(location.search).get("playerId") || localStorage.getItem("yihua-room-player:" + roomId);
      const status = document.getElementById("status");
      const players = document.getElementById("players");
      if (!playerId) { location.replace("/room/${encodedRoomId}"); return; }
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(scheme + "//" + location.host + "/ws/rooms/${encodedRoomId}?playerId=" + encodeURIComponent(playerId));

      const renderPlayers = (message) => {
        const bySeat = new Map(message.participants.map((participant) => [participant.seat, participant]));
        players.innerHTML = "";
        for (let seat = 0; seat < message.playerCount; seat += 1) {
          const participant = bySeat.get(seat);
          const row = document.createElement("div");
          row.className = "player" + (participant && participant.id === playerId ? " me" : "");
          const name = document.createElement("strong");
          name.textContent = participant ? participant.name : "等待玩家加入";
          if (!participant) name.className = "empty";
          const meta = document.createElement("span");
          meta.className = "seat";
          meta.textContent = "座位 " + (seat + 1) + (participant && participant.id === playerId ? " · 我" : "");
          row.append(name, meta);
          players.append(row);
        }
      };

      socket.addEventListener("open", () => { status.textContent = "已连接牌桌"; });
      socket.addEventListener("message", (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "room_state") renderPlayers(message);
        if (message.type === "error") status.textContent = message.message || "连接牌桌时发生错误";
      });
      socket.addEventListener("close", () => { status.textContent = "连接已断开，重新打开链接即可重连"; });
      socket.addEventListener("error", () => { status.textContent = "网络连接失败"; });
    })();
  </script>
</body>
</html>`;
};
