import * as React from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "guandan_custom_hand_sort_enabled";

type Side = "left" | "right";

const GuandanCustomSortControls: React.FunctionComponent = () => {
  const [enabled, setEnabled] = React.useState(
    () => window.localStorage.getItem(STORAGE_KEY) === "on",
  );
  const [settingsTarget, setSettingsTarget] =
    React.useState<HTMLElement | null>(null);

  const nextIdRef = React.useRef(1);
  const orderRef = React.useRef<string[]>([]);
  const draggedStackIdRef = React.useRef<string | null>(null);
  const enabledRef = React.useRef(enabled);

  React.useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const ensureStackIds = React.useCallback((): HTMLElement[] => {
    const stacks = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".guandan-hand .guandan-card-stack",
      ),
    );

    for (const stack of stacks) {
      if (!stack.dataset.customSortId) {
        stack.dataset.customSortId = `custom-stack-${nextIdRef.current++}`;
      }
    }

    const liveIds = stacks.map((stack) => stack.dataset.customSortId!);
    orderRef.current = [
      ...orderRef.current.filter((id) => liveIds.includes(id)),
      ...liveIds.filter((id) => !orderRef.current.includes(id)),
    ];

    return stacks;
  }, []);

  const applyOrder = React.useCallback(() => {
    const stacks = ensureStackIds();
    const positions = new Map(
      orderRef.current.map((id, index) => [id, index]),
    );

    for (const stack of stacks) {
      const id = stack.dataset.customSortId!;
      stack.style.order = enabled ? String(positions.get(id) ?? 0) : "";
      stack.draggable = enabled;
      stack.style.cursor = enabled ? "grab" : "";
      stack.style.display = "";

      if (stack.dataset.customSortBound === "1") continue;
      stack.dataset.customSortBound = "1";

      stack.addEventListener("dragstart", (event) => {
        if (!enabledRef.current) {
          event.preventDefault();
          return;
        }
        draggedStackIdRef.current = stack.dataset.customSortId ?? null;
      });

      stack.addEventListener("dragover", (event) => {
        if (enabledRef.current) event.preventDefault();
      });

      stack.addEventListener("drop", (event) => {
        if (!enabledRef.current) return;
        event.preventDefault();
        const from = draggedStackIdRef.current;
        const to = stack.dataset.customSortId;
        if (!from || !to || from === to) return;

        const order = [...orderRef.current];
        const fromIndex = order.indexOf(from);
        const toIndex = order.indexOf(to);
        if (fromIndex < 0 || toIndex < 0) return;

        order.splice(fromIndex, 1);
        order.splice(toIndex, 0, from);
        orderRef.current = order;
        applyOrder();
      });

      stack.addEventListener("dragend", () => {
        draggedStackIdRef.current = null;
      });
    }
  }, [enabled, ensureStackIds]);

  const moveSelected = React.useCallback(
    (side: Side) => {
      const stacks = ensureStackIds();
      const selectedIds = stacks
        .filter((stack) => stack.querySelector('[aria-pressed="true"]'))
        .map((stack) => stack.dataset.customSortId)
        .filter((id): id is string => Boolean(id));

      if (selectedIds.length === 0) return;

      const selectedSet = new Set(selectedIds);
      const picked = orderRef.current.filter((id) => selectedSet.has(id));
      const rest = orderRef.current.filter((id) => !selectedSet.has(id));
      orderRef.current =
        side === "left" ? [...picked, ...rest] : [...rest, ...picked];
      applyOrder();
    },
    [applyOrder, ensureStackIds],
  );

  const resetOrder = React.useCallback(() => {
    orderRef.current = [];
    const stacks = ensureStackIds();
    orderRef.current = stacks.map((stack) => stack.dataset.customSortId!);
    applyOrder();
  }, [applyOrder, ensureStackIds]);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    window.localStorage.removeItem("guandan_custom_stack_mode_enabled");
    document
      .querySelector<HTMLElement>(".guandan-hand")
      ?.classList.remove("guandan-custom-stack-mode");
    applyOrder();
  }, [enabled, applyOrder]);

  React.useEffect(() => {
    const refresh = () => {
      setSettingsTarget(
        document.querySelector<HTMLElement>(".guandan-settings"),
      );
      applyOrder();
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyOrder]);

  const globalStyles = (
    <style>{`
      .guandan-play-actions {
        gap: 18px !important;
        align-items: center;
        justify-content: center;
      }
      .guandan-play-actions > button:last-of-type,
      .guandan-play-actions > button:nth-last-of-type(2) {
        min-width: 142px;
        min-height: 62px;
        padding: 13px 28px !important;
        border-width: 2px !important;
        border-radius: 17px !important;
        font-size: 1.35rem !important;
        font-weight: 950 !important;
        letter-spacing: .08em;
        box-shadow: 0 5px 0 #8b681d, 0 8px 16px rgb(0 0 0 / 24%) !important;
      }
      .guandan-play-actions > button:nth-last-of-type(2) {
        border-color: #ffe08a !important;
        background: linear-gradient(180deg, #ffdf64, #e7a92b) !important;
        color: #4b2b00 !important;
      }
      .guandan-play-actions > button:last-of-type {
        border-color: #d8efe3 !important;
        background: linear-gradient(180deg, #f6fff9, #cde8d7) !important;
        color: #175336 !important;
      }
      @media (max-width: 760px) {
        .guandan-play-actions > button:last-of-type,
        .guandan-play-actions > button:nth-last-of-type(2) {
          min-width: 132px;
          min-height: 60px;
          padding: 12px 22px !important;
          font-size: 1.25rem !important;
        }
      }
    `}</style>
  );

  return (
    <>
      {globalStyles}
      {settingsTarget &&
        createPortal(
          <div className="guandan-custom-sort-setting">
            <hr />
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />{" "}
              玩家自由组合牌排序
            </label>
            <p>同数字牌保持自动叠加；开启后可拖动整组同数字牌调整位置。</p>
            {enabled && (
              <div className="guandan-actions" aria-label="自由组合牌排序操作">
                <button
                  type="button"
                  className="normal"
                  onClick={() => moveSelected("left")}
                >
                  所选牌移到左侧
                </button>
                <button
                  type="button"
                  className="normal"
                  onClick={() => moveSelected("right")}
                >
                  所选牌移到右侧
                </button>
                <button type="button" className="normal" onClick={resetOrder}>
                  重置自由排序
                </button>
              </div>
            )}
          </div>,
          settingsTarget,
        )}
    </>
  );
};

export default GuandanCustomSortControls;
