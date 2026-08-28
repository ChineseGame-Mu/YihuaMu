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
    .field { margin-top: 16px; }
    .field:first-child { margin-top: 0; }
    label { display: block; margin-bottom: 8px; font-weight: 700; }
    input, select { width: 100%; min-height: 54px; border: 1.5px solid #b7cdbd; border-radius: 14px; padding: 0 16px; font-size: 18px; outline: none; background: #fff; color: #173d29; }
    input:focus, select:focus { border-color: #2d7a4d; box-shadow: 0 0 0 4px rgba(45,122,77,.12); }
    select:disabled { background: #f2f6f3; color: #52705e; }
    .count-note { margin: 7px 2px 0; color: #6a7c70; font-size: 13px; }
    button { width: 100%; min-height: 56px; margin-top: 20px; border: 0; border-radius: 14px; font-size: 19px; font-weight: 800; color: #fff; background: #247447; cursor: pointer; }
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
      <div class="field">
        <label for="player-count">开始人数：4–14 人</label>
        <select id="player-count" name="playerCount">
          <option value="4">4 人</option>
          <option value="6">6 人</option>
          <option value="8">8 人</option>
          <option value="10">10 人</option>
          <option value="12">12 人</option>
          <option value="14">14 人</option>
        </select>
        <p id="count-note" class="count-note">第一位进入的玩家确定开始人数；之后可继续增加到 14 人。</p>
      </div>
      <div class="field">
        <label for="player-name">您的姓名</label>
        <input id="player-name" name="playerName" maxlength="16" autocomplete="name" enterkeyhint="go" placeholder="请输入姓名" required>
      </div>
      <button id="join-button" type="submit">进入牌室</button>
    </form>
    <p class="hint">全部使用真人。游戏开始后 3 小时内可继续加入；人数按 6→8→10→12→14 逐步增加，当前一局不中断，新玩家从满足偶数人数后的下一局开始参赛。</p>
    <p id="join-status" class="status" role="status" aria-live="polite"></p>
  </main>
  <script>
    (() => {
      const roomId = decodeURIComponent("${encodedRoomId}");
      const form = document.getElementById("join-form");
      const input = document.getElementById("player-name");
      const count = document.getElementById("player-count");
      const countNote = document.getElementById("count-note");
      const button = document.getElementById("join-button");
      const status = document.getElementById("join-status");
      const params = new URLSearchParams(location.search);
      const storageKey = "yihua-room-name:" + roomId;
      const queryName = (params.get("playerName") || "").trim();
      const priorName = localStorage.getItem(storageKey);
      if (queryName) input.value = queryName;
      else if (priorName) input.value = priorName;
      const requestedCount = Number(params.get("playerCount"));
      if ([4, 6, 8, 10, 12, 14].includes(requestedCount)) {
        count.value = String(requestedCount);
      }
      setTimeout(() => {
        if (input.value) button.focus();
        else input.focus();
      }, 0);

      const randomId = () => {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
        return "player-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      };

      const connectUrl = (playerId) => {
        const scheme = location.protocol === "https:" ? "wss:" : "ws:";
        const suffix = playerId ? "?playerId=" + encodeURIComponent(playerId) : "";
        return scheme + "//" + location.host + "/ws/rooms/${encodedRoomId}" + suffix;
      };

      const readExistingRoom = async () => {
        const response = await fetch("/api/rooms/${encodedRoomId}");
        if (response.status === 404) return false;
        if (!response.ok) throw new Error("无法读取牌室状态");
        const data = await response.json();
        count.value = String(data.room.config.playerCount);
        count.disabled = true;
        if (typeof data.room.joinClosesAt === "number") {
          const remainingMs = data.room.joinClosesAt - Date.now();
          if (remainingMs <= 0) {
            countNote.textContent = "今晚牌室的 3 小时入室时间已结束。";
          } else {
            const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
            countNote.textContent = "当前已扩展到 " + data.room.config.playerCount + " 人；后到真人还可在约 " + minutes + " 分钟内加入，最多 14 人。";
          }
        } else {
          countNote.textContent = "当前开始人数为 " + data.room.config.playerCount + " 人；开局后 3 小时内仍可逐步增加到 14 人。";
        }
        return true;
      };

      const ensureRoom = async () => {
        if (await readExistingRoom()) return;
        const playerCount = Number(count.value);
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId, playerCount }),
        });
        if (response.status === 409) {
          await readExistingRoom();
          return;
        }
        if (!response.ok) throw new Error("无法建立牌室");
        count.disabled = true;
        countNote.textContent = "本桌从 " + playerCount + " 人开始，之后可继续增加到 14 人。";
      };

      void readExistingRoom().catch(() => {
        countNote.textContent = "请选择今晚开始参加人数。";
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) { status.textContent = "请输入您的姓名。"; input.focus(); return; }
        button.disabled = true;
        status.textContent = "正在进入牌室…";

        try {
          await ensureRoom();
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : "无法建立牌室，请重试。";
          button.disabled = false;
          return;
        }

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
          if (message.type === "error") {
            const text = String(message.message || "");
            if (text.includes("three-hour join window")) {
              fail("本牌室的 3 小时入室时间已结束。");
            } else if (text.includes("14-player maximum")) {
              fail("本牌室已经达到 14 人上限。");
            } else {
              fail(text || "无法进入牌室，请重试。");
            }
            return;
          }
          if (message.type !== "room_state" || joined) return;
          const occupied = new Set(message.participants.map((participant) => participant.seat));
          let seat = -1;
          for (let candidate = 0; candidate < message.playerCount; candidate += 1) {
            if (!occupied.has(candidate)) { seat = candidate; break; }
          }
          if (seat < 0 && message.playerCount < 14) seat = message.playerCount;
          if (seat < 0) { fail("本牌室已经达到 14 人上限。"); return; }
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
