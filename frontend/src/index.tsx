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
import Welcome from "./Welcome";

const WasmProvider = React.lazy(
  async () => await import("./WasmOrRpcProvider"),
);

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

  // This isolated TWO-GAME test site must always open the selection homepage.
  // Never show a game lobby or a remembered room on a bare homepage URL.
  if (game !== "tractor" && game !== "findingfriends") {
    root_.render(
      <Welcome
        onSelectGameMode={(mode) => {
          const query = mode === "Tractor" ? "tractor" : "findingfriends";
          window.location.assign(window.location.pathname + "?game=" + query);
        }}
      />,
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
