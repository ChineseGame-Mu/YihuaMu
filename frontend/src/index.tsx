import { createRoot } from "react-dom/client";
import * as React from "react";
import ReactModal from "react-modal";
import * as Sentry from "@sentry/react";

import "./style.css";
import "./guandan.css";
import "./guandan-single-viewport.css";
import "./guandan-review-panel-fix.css";
import "./guandan-review-third.css";
import "./guandan-approved-layout.css";
import "./guandan-header-decor.css";
import "./game-logos.css";
import "./guandan-settings-card-hints.css";
import "./guandan-statusbar-restore.css";
import "./guandan-topbar-final.css";
import "./guandan-button-3d.css";
import "./guandan-public-player-position.css";
import "./guandan-play-author-hotfix.css";

import AppStateProvider from "./AppStateProvider";
import WebsocketProvider from "./WebsocketProvider";
import TimerProvider from "./TimerProvider";
import Root from "./Root";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";
import GuandanNoBeatHint from "./GuandanNoBeatHint";
import GuandanNoBeatControls from "./GuandanNoBeatControls";
import ExitGameButton from "./ExitGameButton";
import GuandanHeaderDecor from "./GuandanHeaderDecor";
import GuandanCustomSortControls from "./GuandanCustomSortControls";

const WasmProvider = React.lazy(
  async () => await import("./WasmOrRpcProvider"),
);

const returnToGameSelection = (): void => {
  window.location.href = `${window.location.origin}${window.location.pathname}`;
};

const bootstrap = (): void => {
  Sentry.init({
    dsn: "https://dfdd871554eb4ab48de73a6575c1117a@o476591.ingest.sentry.io/5516535",
    release: (window as any)._VERSION,
    ignoreErrors: [
      /Promise.*is.*defined/,
      /WebAssembly.*is.*defined/,
      /fetch.*is.*defined/,
      "Can't find variable: fetch",
      "Can't find variable: WebAssembly",
      /Loading chunk.*failed/,
      /ChunkLoadError/,
      /Const declarations are not supported in strict mode/,
    ],
  });

  const root = document.getElementById("root");
  const fallback = (
    <>
      An error has occured, please try refreshing! If that doesn&apos;t resolve
      the issue, consider using the latest version of Mozilla Firefox or Google
      Chrome browsers.
    </>
  );
  ReactModal.setAppElement(root!);
  const root_ = createRoot(root!);

  const params = new URLSearchParams(window.location.search);
  const game = params.get("game");

  // Test Version 2: show a dedicated entry page before the existing game lobby.
  // This intentionally changes no GuandanTable logic or production branch.
  if (game === null) {
    root_.render(
      <main style={{ minHeight: "100vh", background: "linear-gradient(155deg,#083b2b,#146446)", color: "#fff8da", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "sans-serif" }}>
        <section style={{ width: "min(100%,480px)", border: "2px solid #d6b66d", borderRadius: 22, padding: "48px 24px", textAlign: "center", background: "rgba(0,0,0,.17)", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
          <div style={{ fontSize: 43, marginBottom: 14 }} aria-hidden="true">🂡　♥　♠　🃏</div>
          <h1 style={{ fontSize: 54, margin: "12px 0", letterSpacing: 12, color: "#f4d385" }}>掼蛋</h1>
          <p style={{ fontSize: 19, margin: "12px 0 32px", color: "#e4e8d3" }}>独立掼蛋游戏 · Guandan</p>
          <button type="button" onClick={() => { window.location.search = "?game=guandan"; }}
            style={{ border: "1px solid #f9e5a3", background: "#e7bf65", color: "#163e2c", borderRadius: 12, fontSize: 22, fontWeight: 700, padding: "15px 40px", cursor: "pointer" }}>
            进入牌室
          </button>
          <p style={{ marginTop: 26, fontSize: 13, color: "#deeadc" }}>测试版本2 · 仅供测试，正式网站不受影响</p>
        </section>
      </main>,
    );
    return;
  }

  if (game === "guandan") {
    root_.render(
      <React.Suspense fallback={fallback}>
        <TimerProvider>
          <GuandanWebsocketProvider>
            <GuandanStateProvider>
              <ExitGameButton onClick={returnToGameSelection} />
              <GuandanHeaderDecor />
              <GuandanCustomSortControls />
              <GuandanTable />
              <GuandanNoBeatHint />
              <GuandanNoBeatControls />
            </GuandanStateProvider>
          </GuandanWebsocketProvider>
        </TimerProvider>
      </React.Suspense>,
    );
    return;
  }

  root_.render(
    <React.Suspense fallback={fallback}>
      <WasmProvider>
        <AppStateProvider>
          <WebsocketProvider>
            <TimerProvider>
              <Root />
            </TimerProvider>
          </WebsocketProvider>
        </AppStateProvider>
      </WasmProvider>
    </React.Suspense>,
  );
};

bootstrap();
