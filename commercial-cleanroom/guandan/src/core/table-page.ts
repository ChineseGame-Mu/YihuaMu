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
  <title>掼蛋牌室 ${safeRoomId}</title>
  <style>
    :root { color-scheme: light; font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:#0b6b3a; color:#fff6cf; overflow-x:hidden; }
    button,select,input { font:inherit; }
    .guandan-shell { min-height:100vh; background:linear-gradient(180deg,#0b6b3a 0%,#07532f 100%); }
    .guandan-topbar { min-height:66px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px; padding:8px 14px; border-bottom:2px solid #d7a72d; background:#064b2b; box-shadow:0 3px 12px rgba(0,0,0,.28); }
    .guandan-top-left,.guandan-top-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .guandan-top-right { justify-content:flex-end; }
    .guandan-exit { border:2px solid #f2cd62; background:linear-gradient(#b92f25,#7f1610); color:#fff6d2; border-radius:8px; padding:8px 13px; font-weight:900; box-shadow:0 3px 0 #4d0d08; }
    .guandan-title { text-align:center; font-size:30px; line-height:1; font-weight:1000; color:#f5d06a; text-shadow:0 2px 0 #6a3c00,0 0 12px rgba(255,210,90,.2); white-space:nowrap; }
    .guandan-chip { border:1px solid rgba(255,223,131,.55); border-radius:8px; padding:7px 9px; background:rgba(0,0,0,.14); color:#fff6cf; font-weight:800; }
    .guandan-settings { width:38px; height:38px; border-radius:9px; border:1px solid #cfb25b; background:#ece4c3; color:#4f3d09; font-weight:900; }
    .guandan-zone { margin:10px auto; width:min(1180px,calc(100% - 16px)); border:2px solid #d4ad3f; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.22); }
    .guandan-zone-title { display:flex; align-items:baseline; gap:12px; padding:8px 12px; background:linear-gradient(#d8b548,#b98a24); color:#352300; font-weight:1000; }
    .guandan-zone-title span { font-size:20px; }
    .guandan-zone-title small { font-size:12px; font-weight:800; }
    .guandan-public-zone { background:#0c6639; min-height:430px; }
    .guandan-board { position:relative; padding:12px; display:grid; gap:12px; }
    .guandan-meta { display:flex; gap:8px; flex-wrap:wrap; }
    .guandan-meta .guandan-chip { background:#07512e; }
    .guandan-players { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:8px; }
    .guandan-player-card { min-height:62px; padding:8px 9px; border:1px solid rgba(255,228,143,.42); border-radius:9px; background:rgba(2,63,35,.7); color:#fff6cf; display:flex; flex-direction:column; gap:3px; }
    .guandan-player-card.is-me { outline:2px solid #f3cf61; }
    .guandan-player-card.is-active { box-shadow:inset 0 0 0 3px #ffcc36,0 0 12px rgba(255,206,62,.4); }
    .guandan-seat-badge { display:inline-grid; place-items:center; width:24px; height:24px; border-radius:50%; background:#d6ad39; color:#352300; font-weight:1000; float:left; margin-right:6px; }
    .guandan-online { font-size:12px; color:#b9efc7; }
    .guandan-table-stage { min-height:200px; border:1px solid rgba(255,226,137,.32); border-radius:12px; padding:12px; background:rgba(1,75,41,.55); }
    .guandan-table-stage h2 { margin:0 0 10px; text-align:center; color:#f6d36d; }
    .cards { display:flex; flex-wrap:wrap; justify-content:center; align-items:flex-end; min-height:80px; gap:0; padding-right:20px; }
    .card { width:58px; height:82px; margin-right:-22px; border:1px solid #b6b6b6; border-radius:7px; background:#fff; color:#111; display:grid; place-items:center; font-size:19px; font-weight:1000; box-shadow:0 2px 5px rgba(0,0,0,.25); }
    button.card { cursor:pointer; }
    .card.red { color:#c32121; }
    .card.selected { transform:translateY(-13px); outline:3px solid #f0bd31; z-index:50; }
    .guandan-opening-draw { display:none; padding:8px; border-radius:9px; background:rgba(0,0,0,.13); }
    .guandan-opening-draw.visible { display:block; }
    .guandan-opening-draw strong { display:block; margin-bottom:6px; color:#f6d36d; }
    .guandan-private-zone { background:#f2e7bc; color:#3c3117; }
    .guandan-private-inner { padding:12px; display:grid; grid-template-columns:1fr 190px; gap:12px; }
    .guandan-hand-wrap { min-height:230px; background:#efe0a7; border:1px solid #bda256; border-radius:10px; padding:10px; }
    .guandan-hand-title { font-weight:1000; margin-bottom:12px; }
    .guandan-actions-panel { border:1px solid #bda256; border-radius:10px; background:#f6ecc9; padding:10px; display:flex; flex-direction:column; gap:10px; }
    .guandan-action { border:0; border-radius:9px; padding:13px 10px; font-weight:1000; cursor:pointer; box-shadow:0 3px 0 rgba(0,0,0,.22); }
    .guandan-play { background:linear-gradient(#d7aa31,#aa7410); color:#fff8d9; }
    .guandan-pass { background:linear-gradient(#2e7cc2,#195791); color:#fff; }
    .guandan-start { background:linear-gradient(#3b8c4d,#20652f); color:#fff; }
    .guandan-next { background:linear-gradient(#bd6f23,#8a4914); color:#fff; }
    .guandan-action:disabled { opacity:.42; cursor:not-allowed; box-shadow:none; }
    .guandan-review { min-height:76px; border:1px dashed #ae934c; border-radius:8px; padding:8px; background:#fff7db; }
    .guandan-review strong { display:block; margin-bottom:6px; }
    .guandan-statusbar { width:min(1180px,calc(100% - 16px)); margin:0 auto 12px; padding:7px 10px; border:1px solid rgba(255,224,125,.45); border-radius:8px; background:#064b2b; color:#f6e9b7; font-size:13px; }
    .notice { min-height:20px; color:#7e1717; font-weight:800; }
    .muted { opacity:.75; }
    .choice { display:none; margin-top:8px; padding:8px; border-radius:8px; background:#fff1bd; }
    .choice.visible { display:block; }
    @media (max-width:720px) {
      .guandan-topbar { grid-template-columns:1fr; text-align:center; }
      .guandan-top-left,.guandan-top-right { justify-content:center; }
      .guandan-title { order:-1; font-size:25px; }
      .guandan-private-inner { grid-template-columns:1fr; }
      .guandan-actions-panel { display:grid; grid-template-columns:1fr 1fr; }
      .guandan-review { grid-column:1/-1; }
      .card { width:48px; height:70px; margin-right:-18px; font-size:17px; }
    }
  </style>
</head>
<body>
  <main class="guandan-shell">
    <header class="guandan-topbar">
      <div class="guandan-top-left">
        <button class="guandan-exit" type="button" onclick="location.href='/room/${encodedRoomId}'">退出</button>
        <span class="guandan-chip">本局打 <b>2</b></span>
        <span class="guandan-chip">连接状态：<b id="status">connecting</b></span>
        <span class="guandan-chip">房间：<b>${safeRoomId}</b></span>
        <button class="guandan-settings" type="button" aria-label="设置">⚙</button>
      </div>
      <div class="guandan-title">掼 蛋</div>
      <div class="guandan-top-right"><span class="guandan-chip">计时 <b id="timer">00:00</b></span></div>
    </header>

    <section class="guandan-zone guandan-public-zone" aria-label="公共桌面">
      <div class="guandan-zone-title"><span>公共桌面</span><small>所有玩家共同可见</small></div>
      <div class="guandan-board">
        <div class="guandan-meta">
          <span class="guandan-chip">阶段：<b id="phase">等待开局</b></span>
          <span class="guandan-chip">当前应出牌：<b id="turn">—</b></span>
          <span class="guandan-chip">首局抽牌赢家：<b id="drawWinner">—</b></span>
          <span class="guandan-chip">完成墩数：<b id="tricks">0</b></span>
        </div>
        <div id="players" class="guandan-players"></div>
        <aside id="openingDrawBox" class="guandan-opening-draw"><strong>首局抽牌</strong><div id="openingDraw" class="cards"></div></aside>
        <section class="guandan-table-stage"><h2>本轮出牌</h2><div id="leadingPlay" class="cards"><span class="muted">暂无出牌</span></div></section>
      </div>
    </section>

    <section class="guandan-zone guandan-private-zone" aria-label="我的桌面">
      <div class="guandan-zone-title"><span>我的桌面</span><small>仅显示我的手牌与操作</small></div>
      <div class="guandan-private-inner">
        <section class="guandan-hand-wrap">
          <div class="guandan-hand-title">我的手牌 <span id="handCount"></span></div>
          <div id="hand" class="cards"><span class="muted">等待发牌</span></div>
        </section>
        <aside class="guandan-actions-panel">
          <button id="startGame" class="guandan-action guandan-start" type="button" disabled>抽牌决定首家并开始</button>
          <button id="playCards" class="guandan-action guandan-play" type="button" disabled>出牌</button>
          <button id="passTurn" class="guandan-action guandan-pass" type="button" disabled>过牌</button>
          <button id="nextRound" class="guandan-action guandan-next" type="button" disabled>开始下一局</button>
          <div class="guandan-review"><strong>待出牌核对区</strong><div id="reviewCards" class="cards"></div></div>
          <div id="choice" class="choice">
            <div id="choiceText">本轮正在进行。你可以选择是否加入下一轮。</div>
            <button id="joinNext" class="guandan-action guandan-start" type="button">加入下一轮</button>
            <button id="waitNext" class="guandan-action guandan-pass" type="button">继续等待</button>
          </div>
          <div id="notice" class="notice" role="status" aria-live="polite"></div>
        </aside>
      </div>
    </section>
    <div class="guandan-statusbar">状态：<span id="bottomStatus">正在连接牌桌…</span></div>
  </main>
  <script>
    (() => {
      const roomId = decodeURIComponent("${encodedRoomId}");
      const params = new URLSearchParams(location.search);
      const playerId = params.get("playerId") || localStorage.getItem("yihua-room-player:" + roomId);
      if (!playerId) { location.replace("/room/${encodedRoomId}"); return; }

      const byId = (id) => document.getElementById(id);
      const status = byId("status");
      const bottomStatus = byId("bottomStatus");
      const players = byId("players");
      const phase = byId("phase");
      const turn = byId("turn");
      const drawWinner = byId("drawWinner");
      const tricks = byId("tricks");
      const openingDraw = byId("openingDraw");
      const openingDrawBox = byId("openingDrawBox");
      const leadingPlay = byId("leadingPlay");
      const hand = byId("hand");
      const reviewCards = byId("reviewCards");
      const handCount = byId("handCount");
      const notice = byId("notice");
      const startGame = byId("startGame");
      const playCards = byId("playCards");
      const passTurn = byId("passTurn");
      const nextRound = byId("nextRound");
      const choice = byId("choice");
      const choiceText = byId("choiceText");
      const joinNext = byId("joinNext");
      const waitNext = byId("waitNext");
      const timer = byId("timer");
      let seconds = 0;
      setInterval(() => { seconds += 1; timer.textContent = String(Math.floor(seconds / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0"); }, 1000);

      let latestRoomState = null;
      let latestGameState = null;
      let latestHand = null;
      let activePlayerCount = null;
      const selected = new Set();
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(scheme + "//" + location.host + "/ws/rooms/${encodedRoomId}?playerId=" + encodeURIComponent(playerId));

      const cardText = (card) => {
        if (card.kind === "joker") return card.size === "big" ? "大王" : "小王";
        const suits = { clubs:"♣", diamonds:"♦", spades:"♠", hearts:"♥" };
        return (suits[card.suit] || "") + card.rank;
      };
      const isRed = (card) => card.kind === "suited" && (card.suit === "diamonds" || card.suit === "hearts");
      const playerName = (seat) => latestRoomState?.participants.find((participant) => participant.seat === seat)?.name || "玩家" + (Number(seat) + 1);
      const mySeat = () => latestRoomState?.participants.find((participant) => participant.id === playerId)?.seat ?? -1;

      const renderCards = (container, cards, selectable = false) => {
        container.innerHTML = "";
        if (!cards || cards.length === 0) { container.innerHTML = '<span class="muted">暂无</span>'; return; }
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

      const renderReview = () => {
        const cards = (latestHand?.cards || []).filter((entry) => selected.has(entry.id));
        renderCards(reviewCards, cards, false);
      };

      const renderPlayers = () => {
        if (!latestRoomState) return;
        const bySeat = new Map(latestRoomState.participants.map((participant) => [participant.seat, participant]));
        players.innerHTML = "";
        for (let seat = 0; seat < latestRoomState.playerCount; seat += 1) {
          const participant = bySeat.get(seat);
          const row = document.createElement("div");
          row.className = "guandan-player-card";
          if (participant?.id === playerId) row.classList.add("is-me");
          if (latestGameState?.currentTurn === seat) row.classList.add("is-active");
          const count = latestGameState?.handCounts?.[seat];
          row.innerHTML = '<div><span class="guandan-seat-badge">' + (seat + 1) + '</span><strong>' + (participant ? participant.name : "等待玩家加入") + '</strong></div><span class="guandan-online">● 在线</span><span>剩余：' + (typeof count === "number" ? count + " 张" : "待发牌") + '</span>';
          players.append(row);
        }
      };

      const renderHand = () => {
        const cards = latestHand?.cards || [];
        const validIds = new Set(cards.map((entry) => entry.id));
        [...selected].forEach((id) => { if (!validIds.has(id)) selected.delete(id); });
        handCount.textContent = cards.length ? "（" + cards.length + "）" : "";
        renderCards(hand, cards, true);
        renderReview();
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
          drawWinner.textContent = "—";
          tricks.textContent = "0";
          openingDrawBox.classList.remove("visible");
          renderCards(leadingPlay, []);
          updateControls();
          return;
        }
        activePlayerCount = latestGameState.handCounts.length;
        phase.textContent = latestGameState.phase === "playing" ? "进行中" : latestGameState.phase === "round-complete" ? "本局结束" : "首局抽牌";
        turn.textContent = latestGameState.currentTurn === null ? "—" : playerName(latestGameState.currentTurn);
        drawWinner.textContent = latestGameState.openingDrawWinner === null ? "—" : playerName(latestGameState.openingDrawWinner);
        tricks.textContent = String(latestGameState.completedTricks || 0);
        const draws = latestGameState.openingDraw || [];
        openingDrawBox.classList.toggle("visible", draws.length > 0);
        renderCards(openingDraw, draws);
        renderCards(leadingPlay, latestGameState.leadingPlay?.cards || []);
        renderPlayers();
        renderChoice();
        updateControls();
      };

      const send = (message) => {
        if (socket.readyState !== WebSocket.OPEN) { notice.textContent = "网络尚未连接。"; return; }
        const payload = latestGameState && message.type !== "start_game"
          ? { ...message, expectedRevision: latestGameState.revision, commandId: message.type + "-" + Date.now() }
          : { ...message, commandId: message.type + "-" + Date.now() };
        notice.textContent = "";
        socket.send(JSON.stringify(payload));
      };

      startGame.addEventListener("click", () => send({ type:"start_game" }));
      playCards.addEventListener("click", () => send({ type:"play_cards", cardIds:[...selected] }));
      passTurn.addEventListener("click", () => send({ type:"pass_turn" }));
      nextRound.addEventListener("click", () => send({ type:"next_round" }));
      joinNext.addEventListener("click", () => send({ type:"set_next_round_ready", ready:true }));
      waitNext.addEventListener("click", () => send({ type:"set_next_round_ready", ready:false }));

      socket.addEventListener("open", () => { status.textContent = "connected"; bottomStatus.textContent = "已连接服务器"; });
      socket.addEventListener("close", () => { status.textContent = "disconnected"; bottomStatus.textContent = "连接已断开，请刷新页面重连"; });
      socket.addEventListener("error", () => { status.textContent = "error"; bottomStatus.textContent = "连接异常"; });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "room_state") { latestRoomState = message; renderPlayers(); renderChoice(); updateControls(); }
        if (message.type === "game_state") { latestGameState = message; selected.clear(); renderGame(); renderHand(); }
        if (message.type === "private_hand") { latestHand = message; renderHand(); updateControls(); }
        if (message.type === "error") { notice.textContent = message.message || "操作失败"; }
      });
    })();
  </script>
</body>
</html>`;
};
