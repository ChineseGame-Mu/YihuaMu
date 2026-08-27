const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderJoinPage = (roomId: string): string => {
  const safeRoomId = escapeHtml(roomId);
  const encodedRoomId = encodeURIComponent(roomId);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>加入牌室 ${safeRoomId}</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(145deg,#eef8f1,#dcefe3); color: #173d29; }
    .join-shell { width: min(100%, 430px); background: rgba(255,255,255,.96); border: 1px solid rgba(23,61,41,.12); border-radius: 24px; padding: 30px 24px; box-shadow: 0 20px 55px rgba(23,61,41,.14); }
    .join-title { margin: 0; font-size: 30px; text-align: center; }
    .room-label { margin: 10px 0 26px; text-align: center; color: #52705e; font-size: 15px; }
    .room-code { font-weight: 800; color: #245c3a; }
    label { display: block; margin-bottom: 8px; font-weight: 700; }
    input { width: 100%; min-height: 54px; border: 1.5px solid #b7cdbd; border-radius: 14px; padding: 0 16px; font-size: 18px; outline: none; background: #fff; }
    input:focus { border-color: #2d7a4d; box-shadow: 0 0 0 4px rgba(45,122,77,.12); }
    button { width: 100%; min-height: 56px; margin-top: 16px; border: 0; border-radius: 14px; font-size: 19px; font-weight: 800; color: #fff; background: #247447; cursor: pointer; }
    button:disabled { opacity: .55; cursor: wait; }
    .hint { margin: 14px 0 0; text-align: center; color: #6a7c70; font-size: 14px; }
    .status { min-height: 22px; margin: 14px 0 0; text-align: center; color: #9b2f2f; font-size: 14px; }
  </style>
</head>
<body>
  <main class="join-shell">
    <h1 class="join-title">加入牌室</h1>
    <p class="room-label">房间：<span class="room-code">${safeRoomId}</span></p>
    <form id="join-form">
      <label for="player-name">您的姓名</label>
      <input id="player-name" name="playerName" maxlength="16" autocomplete="name" enterkeyhint="go" placeholder="请输入姓名" required>
      <button id="join-button" type="submit">进入牌室</button>
    </form>
    <p class="hint">无需注册，输入姓名即可加入</p>
    <p id="join-status" class="status" role="status" aria-live="polite"></p>
  </main>
  <script>
    (() => {
      const roomId = decodeURIComponent("${encodedRoomId}");
      const form = document.getElementById("join-form");
      const input = document.getElementById("player-name");
      const button = document.getElementById("join-button");
      const status = document.getElementById("join-status");
      const storageKey = "yihua-room-name:" + roomId;
      const priorName = localStorage.getItem(storageKey);
      if (priorName) input.value = priorName;
      setTimeout(() => input.focus(), 0);

      const randomId = () => {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
        return "player-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      };

      const connectUrl = (playerId) => {
        const scheme = location.protocol === "https:" ? "wss:" : "ws:";
        const suffix = playerId ? "?playerId=" + encodeURIComponent(playerId) : "";
        return scheme + "//" + location.host + "/ws/rooms/${encodedRoomId}" + suffix;
      };

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) { status.textContent = "请输入您的姓名。"; input.focus(); return; }
        button.disabled = true;
        status.textContent = "正在进入牌室…";
        const playerId = randomId();
        const socket = new WebSocket(connectUrl());
        let joined = false;

        const fail = (message) => {
          status.textContent = message;
          button.disabled = false;
          try { socket.close(); } catch {}
        };

        socket.addEventListener("message", (event) => {
          let message;
          try { message = JSON.parse(event.data); } catch { return; }
          if (message.type === "error") { fail(message.message || "无法进入牌室，请重试。"); return; }
          if (message.type !== "room_state" || joined) return;
          const occupied = new Set(message.participants.map((participant) => participant.seat));
          let seat = -1;
          for (let candidate = 0; candidate < message.playerCount; candidate += 1) {
            if (!occupied.has(candidate)) { seat = candidate; break; }
          }
          if (seat < 0) { fail("牌室已满，请联系房主。"); return; }
          joined = true;
          socket.send(JSON.stringify({ type: "join_room", roomId, playerId, name, seat }));
        });

        socket.addEventListener("message", (event) => {
          if (!joined) return;
          let message;
          try { message = JSON.parse(event.data); } catch { return; }
          if (message.type !== "room_state") return;
          const me = message.participants.find((participant) => participant.id === playerId);
          if (!me) return;
          localStorage.setItem(storageKey, name);
          localStorage.setItem("yihua-room-player:" + roomId, playerId);
          socket.close();
          location.assign("/room/${encodedRoomId}/table?playerId=" + encodeURIComponent(playerId));
        });

        socket.addEventListener("error", () => fail("连接失败，请检查网络后重试。"));
        socket.addEventListener("close", () => {
          if (!joined && button.disabled) fail("连接已断开，请重试。");
        });
      });
    })();
  </script>
</body>
</html>`;
};
