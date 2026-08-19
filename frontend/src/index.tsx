import { createRoot } from "react-dom/client";
import * as React from "react";
import ReactModal from "react-modal";
import * as Sentry from "@sentry/react";

import "./style.css";
import "./guandan.css";

import AppStateProvider from "./AppStateProvider";
import WebsocketProvider from "./WebsocketProvider";
import TimerProvider from "./TimerProvider";
import Root from "./Root";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";

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

  const rawGame = new URLSearchParams(window.location.search).get("game") ?? "";
  const game = rawGame.trim().toLowerCase().replace(/\/+$/, "");
  const isGuandan = game === "guandan";

  if (isGuandan) {
    root_.render(
      <Sentry.ErrorBoundary fallback={fallback}>
        <GuandanWebsocketProvider>
          <GuandanStateProvider>
            <div>
              <div style={{ textAlign: "center", margin: "12px 0" }}>
                <button
                  type="button"
                  className="normal"
                  onClick={returnToGameSelection}
                >
                  重新选择
                </button>
              </div>
              <GuandanTable />
            </div>
          </GuandanStateProvider>
        </GuandanWebsocketProvider>
      </Sentry.ErrorBoundary>,
    );
    return;
  }

  root_.render(
    <Sentry.ErrorBoundary fallback={fallback}>
      <React.Suspense fallback={"loading..."}>
        <WasmProvider>
          <TimerProvider>
            <AppStateProvider>
              <WebsocketProvider>
                <Sentry.ErrorBoundary fallback={fallback}>
                  <Root />
                </Sentry.ErrorBoundary>
              </WebsocketProvider>
            </AppStateProvider>
          </TimerProvider>
        </WasmProvider>
      </React.Suspense>
    </Sentry.ErrorBoundary>,
  );
};

bootstrap();
