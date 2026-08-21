import { createRoot } from "react-dom/client";
import * as React from "react";
import ReactModal from "react-modal";
import * as Sentry from "@sentry/react";

import "./style.css";
import "./guandan.css";
import "./game-logos.css";

import AppStateProvider from "./AppStateProvider";
import WebsocketProvider from "./WebsocketProvider";
import TimerProvider from "./TimerProvider";
import Root from "./Root";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";
import GuandanNoBeatHint from "./GuandanNoBeatHint";
import GuandanNoBeatControls from "./GuandanNoBeatControls";

const WasmProvider = React.lazy(
  async () => await import("./WasmOrRpcProvider"),
);

const returnToGameSelection = (): void => {
  window.location.href = `${window.location.origin}${window.location.pathname}`;
};

const GuandanClock = (): React.ReactElement => {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return (
    <div
      className="guandan-clock"
      role="timer"
      aria-label={now.toLocaleTimeString()}
      title={now.toLocaleTimeString()}
    >
      <span
        className="guandan-clock-hand guandan-clock-hour"
        style={{ transform: `rotate(${hours * 30}deg)` }}
      />
      <span
        className="guandan-clock-hand guandan-clock-minute"
        style={{ transform: `rotate(${minutes * 6}deg)` }}
      />
      <span
        className="guandan-clock-hand guandan-clock-second"
        style={{ transform: `rotate(${seconds * 6}deg)` }}
      />
      <span className="guandan-clock-pin" />
    </div>
  );
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
              <div className="guandan-topbar">
                <span className="guandan-brand-logo" aria-hidden="true" />
                <h1>掼蛋</h1>
                <button
                  type="button"
                  className="normal guandan-reselect-button"
                  onClick={returnToGameSelection}
                >
                  重新选择
                </button>
                <GuandanClock />
              </div>
              <GuandanNoBeatHint />
              <GuandanNoBeatControls />
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
