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
    :root { color-scheme: light; font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: 14px; background: linear-gradient(145deg,#0b6b3a,#09532f); color: #173d29; }
    .table-shell { width: min(100%,1000px); margin: 0 auto; display: grid; gap: 12px; }
    .panel { background: rgba(255,255,255,.97); border: 1px solid rgba(23,61,41,.12); border-radius: 18px; padding: 16px; box-shadow: 0 16px 42px rgba(0,0,0,.16); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    h1,h2 { margin: 0; }
    h1 { font-size: 24px; }
    h2 { font-size: 18px; margin-bottom: 10px; }
    .sub { margin: 4px 0 0; color: #5b7564; }
    .status { display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; background: #edf7f0; color: #245c3a; font-weight: 800; }
    .game-meta { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 8px; margin-top: 12px; }
    .metric { padding: 10px 12px; border-radius: 12px; background: #f1f7f3; }
    .metric b { display: block; margin-top: 3px; }
    .players { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 8px; }
    .player { display: flex; justify-content: space-between; gap: 10px; padding: 9px 11px; border-radius: 12px; background: #f4f8f5; }
    .player.me { outline: 2px solid #63a57b; background: #eef8f1; }
    .player.turn { box-shadow: inset 0 0 0 2px #d69d28; }
    .seat { color: #6d7d72; font-size: 13px; white-space: nowrap; }
    .empty { color: #8a988f; }
    .cards { display: flex; flex-wrap: wrap; gap: 7px; min-height: 52px; }
    .card { min-width: 48px; min-height: 66px; border: 1px solid #c8d6cc; border-radius: 9px; background: #fff; padding: 6px; display: grid; place-items: center; font-weight: 900; font-size: 18px; color: #17231b; box-shadow: 0 2px 4px rgba(0,0,0,.08); }
    button.card { cursor: pointer; }
    .card.red { color: #b52828; }
    .card.selected { transform: translateY(-8px); outline: 3px solid #d69d28; }
    .muted { color: #708077; }
    .actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 12px; }
    button.action { border: 0; border-radius: 12px; padding: 11px 16px; font: inherit; font-weight: 900; cursor: pointer; background: #246b43; color: #fff; }
    button.secondary { background: #e5eee8; color: #245c3a; }
    button.warn { background: #b56c20; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .choice { display: none; margin-top: 12px; padding: 12px; border-radius: 12px; background: #f4f8f5; }
    .choice.visible { display: block; }
    .choice p { margin: 0 0 10px; }
    .notice { margin-top: 10px; min-height: 20px; color: #9b2f2f; font-weight: 700; }
    @media (max-width: 600px) { body { padding: 8px; } .panel { padding: 12px; border-radius: 14px; } .card { min-width: 42px; min-height: 58px; } }
  </style>
</head>
<body>
  <main class="table-shell">
    <section class="panel">
      <div class="top">
        <div><h1>Yihua Game · 掼蛋测试桌</h1><p class="sub">房间：${safeRoomId}</p></div>
        <div id="status" class="status">正在连接牌桌…</div>
      </div>
      <div class="game-meta">
        <div class="metric">阶段<b id="phase">等待开局</b></div>
        <div class="metric">当前出牌<b id="turn">—</b></div>
        <div class="metric">首局抽牌赢家<b id="drawWinner">—</b></div>
        <div class="metric">已完成墩数<b id="tricks">0</b></div>
      </div>
      <div class="actions">
        <button id="startGame" class="action" type="button" disabled>开始游戏</button>
        <button id="playCards" class="action" type="button" disabled>出牌</button>
        <button id="passTurn" class="action secondary" type="button" disabled>过牌</button>
        <button id="nextRound" class="action warn" type="button" disabled>开始下一局</button>
      </div>
      <div id="notice" class="notice" role="status" aria-live="polite"></div>
      <div id="choice" class="choice">
        <p id="choiceText">本轮正在进行。你可以选择是否加入下一轮。</p>
        <div class="actions">
          <button id="joinNext" class="action" type="button">加入下一轮</button>
          <button id="waitNext" class="action secondary" type="button">继续等待</button>
        </div>
      </div>
    </section>

    <section class="panel"><h2>玩家</h2><div id="players" class="players"></div></section>
    <section class="panel"><h2>首局抽牌</h2><div id="openingDraw" class="cards"><span class="muted">开局后显示</span></div></section>
    <section class="panel"><h2>桌面当前牌</h2><div id="leadingPlay" class="cards"><span class="muted">暂无出牌</span></div></section>
    <section class="panel"><h2>我的手牌 <span id="handCount" class="muted"></span></h2><div id="hand" class="cards"><span class="muted">等待发牌</span></div></section>
  </main>
  <script>
    (() => {
      const roomId = decodeURIComponent("${encodedRoomId}");
      const params = new URLSearchParams(location.search);
      const playerId = params.get("playerId") || localStorage.getItem("yihua-room-player:" + roomId);
      if (!playerId) { location.replace("/room/${encodedRoomId}"); return; }

      const status = document.getElementById("status");
      const players = document.getElementById("players");
      const phase = document.getElementById("phase");
      const turn = document.getElementById("turn");
      const drawWinner = document.getElementById("drawWinner");
      const tricks = document.getElementById("tricks");
      const openingDraw = document.getElementById("openingDraw");
      const leadingPlay = document.getElementById("leadingPlay");
      const hand = document.getElementById("hand");
      const handCount = document.getElementById("handCount");
      const notice = document.getElementById("notice");
      const startGame = document.getElementById("startGame");
      const playCards = document.getElementById("playCards");
      const passTurn = document.getElementById("passTurn");
      const nextRound = document.getElementById("nextRound");
      const choice = document.getElementById("choice");
      const choiceText = document.getElementById("choiceText");
      const joinNext = document.getElementById("joinNext");
      const waitNext = document.getElementById("waitNext");

      let latestRoomState = null;
      let latestGameState = null;
      let latestHand = null;
      let activePlayerCount = null;
      const selected = new Set();
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(scheme + "//" + location.host + "/ws/rooms/${encodedRoomId}?playerId=" + encodeURIComponent(playerId));

      const cardText = (card) => {
        if (card.kind === "joker") return card.size === "big" ? "大王" : "小王";
        const suits = { clubs: "♣", diamonds: "♦", spades: "♠", hearts: "♥" };
        return (suits[card.suit] || "") + card.rank;
      };
      const isRed = (card) => card.kind === "suited" && (card.suit === "diamonds" || card.suit === "hearts");
      const playerName = (seat) => latestRoomState?.participants.find((participant) => participant.seat === seat)?.name || "玩家" + (seat + 1);
      const mySeat = () => latestRoomState?.participants.find((participant) => participant.id === playerId)?.seat ?? -1;

      const renderCards = (container, cards, selectable = false) => {
        container.innerHTML = "";
        if (!cards || cards.length === 0) {
          const empty = document.createElement("span");
          empty.className = "muted";
          empty.textContent = "暂无";
          container.append(empty);
          return;
        }
        cards.forEach((entry) => {
          const card = entry.card || entry;
          const node = document.createElement(selectable ? "button" : "div");
          node.className = "card" + (isRed(card) ? " red" : "");
          node.textContent = cardText(card);
          if (selectable) {
            node.type = "button";
            const id = entry.id;
            if (selected.has(id)) node.classList.add("selected");
            node.addEventListener("click", () => {
              if (selected.has(id)) selected.delete(id); else selected.add(id);
              renderHand();
              updateControls();
            });
          }
          container.append(node);
        });
      };

      const renderPlayers = () => {
        if (!latestRoomState) return;
        const bySeat = new Map(latestRoomState.participants.map((participant) => [participant.seat, participant]));
        players.innerHTML = "";
        for (let seat = 0; seat < latestRoomState.playerCount; seat += 1) {
          const participant = bySeat.get(seat);
          const row = document.createElement("div");
          row.className = "player";
          if (participant?.id === playerId) row.classList.add("me");
          if (latestGameState?.currentTurn === seat) row.classList.add("turn");
          const name = document.createElement("strong");
          name.textContent = participant ? participant.name : "等待玩家加入";
          if (!participant) name.className = "empty";
          const meta = document.createElement("span");
          meta.className = "seat";
          const count = latestGameState?.handCounts?.[seat];
          meta.textContent = "座位 " + (seat + 1) + (typeof count === "number" ? " · " + count + "张" : "");
          row.append(name, meta);
          players.append(row);
        }
      };

      const renderHand = () => {
        const cards = latestHand?.cards || [];
        const validIds = new Set(cards.map((entry) => entry.id));
        [...selected].forEach((id) => { if (!validIds.has(id)) selected.delete(id); });
        handCount.textContent = cards.length ? "(" + cards.length + "张)" : "";
        renderCards(hand, cards, true);
      };

      const renderChoice = () => {
        if (!latestRoomState || activePlayerCount === null) { choice.classList.remove("visible"); return; }
        const me = latestRoomState.participants.find((participant) => participant.id === playerId);
        const waiting = me && me.seat >= activePlayerCount;
        choice.classList.toggle("visible", Boolean(waiting));
        if (!waiting) return;
        const ready = me.readyForNextRound === true;
        choiceText.textContent = ready ? "你已选择加入下一轮。" : "本轮正在进行，你正在等待区。";
        joinNext.disabled = ready;
        waitNext.disabled = !ready;
      };

      const updateControls = () => {
        const seat = mySeat();
        const participantCount = latestRoomState?.participants.length || 0;
        const configuredCount = latestRoomState?.playerCount || 0;
        startGame.disabled = Boolean(latestGameState) || participantCount < configuredCount;
        const myTurn = latestGameState?.phase === "playing" && latestGameState.currentTurn === seat;
        playCards.disabled = !myTurn || selected.size === 0;
        passTurn.disabled = !myTurn || latestGameState?.leadingPlay === null;
        nextRound.disabled = latestGameState?.phase !== "round-complete";
      };

      const renderGame = () => {
        if (!latestGameState) {
          phase.textContent = "等待开局";
          turn.textContent = "—";
          renderCards(openingDraw, []);
          renderCards(leadingPlay, []);
          updateControls();
          return;
        }
        activePlayerCount = latestGameState.handCounts.length;
        phase.textContent = latestGameState.phase === "playing" ? "进行中" : "本局结束";
        turn.textContent = playerName(latestGameState.currentTurn);
        drawWinner.textContent = playerName(latestGameState.openingDrawWinner);
        tricks.textContent = String(latestGameState.completedTricks || 0);
        renderCards(openingDraw, latestGameState.openingDraw || []);
        renderCards(leadingPlay, latestGameState.leadingPlay?.cards || []);
        renderPlayers();
        renderChoice();
        updateControls();
      };

      const send = (message) => {
        if (socket.readyState !== WebSocket.OPEN) { notice.textContent = "网络尚未连接。"; return; }
        const withRevision = latestGameState && message.type !== "start_game"
          ? { ...message, expectedRevision: latestGameState.revision, commandId: message.type + "-" + Date.now() }
          : { ...message, commandId: message.type + "-" + Date.now() };
        notice.textContent = "";
        socket.send(JSON.stringify(withRevision));
      };

      startGame.addEventListener("click", () => send({ type: "start_game" }));
      playCards.addEventListener("click", () => send({ type: "play_cards", cardIds: [...selected] }));
      passTurn.addEventListener("click", () => send({ type: "pass_turn" }));
      nextRound.addEventListener("click", () => send({ type: "next_round" }));
      joinNext.addEventListener("click", () => send({ type: "set_next_round_ready", ready: true }));
      waitNext.addEventListener("click", () => send({ type: "set_next_round_ready", ready: false }));

      socket.addEventListener("open", () => { status.textContent = "已连接后台"; });
      socket.addEventListener("message", (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "room_state") {
          latestRoomState = message;
          renderPlayers();
          renderChoice();
          updateControls();
        } else if (message.type === "game_state") {
          latestGameState = message;
          selected.clear();
          renderGame();
        } else if (message.type === "private_hand") {
          latestHand = message;
          renderHand();
          updateControls();
        } else if (message.type === "error") {
          notice.textContent = message.message || "后台返回错误";
          updateControls();
        }
      });
      socket.addEventListener("close", () => { status.textContent = "连接已断开"; notice.textContent = "重新打开页面即可重连。"; updateControls(); });
      socket.addEventListener("error", () => { status.textContent = "网络连接失败"; });
    })();
  </script>
</body>
</html>`;
};
