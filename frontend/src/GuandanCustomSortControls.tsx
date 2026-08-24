import * as React from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "guandan_custom_hand_sort_enabled";

const GuandanCustomSortControls: React.FunctionComponent = () => {
  const [enabled, setEnabled] = React.useState(
    () => window.localStorage.getItem(STORAGE_KEY) === "on",
  );
  const [settingsTarget, setSettingsTarget] = React.useState<HTMLElement | null>(null);
  const orderRef = React.useRef<string[]>([]);
  const nextIdRef = React.useRef(1);
  const draggedIdRef = React.useRef<string | null>(null);

  const ensureStackIds = React.useCallback((): HTMLElement[] => {
    const stacks = Array.from(
      document.querySelectorAll<HTMLElement>(".guandan-hand .guandan-card-stack"),
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
    const positions = new Map(orderRef.current.map((id, index) => [id, index]));
    for (const stack of stacks) {
      const id = stack.dataset.customSortId!;
      stack.style.order = enabled ? String(positions.get(id) ?? 0) : "";
      stack.draggable = enabled;
      stack.style.cursor = enabled ? "grab" : "";
      if (enabled && stack.dataset.customSortBound !== "1") {
        stack.dataset.customSortBound = "1";
        stack.addEventListener("dragstart", () => {
          draggedIdRef.current = stack.dataset.customSortId ?? null;
        });
        stack.addEventListener("dragover", (event) => event.preventDefault());
        stack.addEventListener("drop", (event) => {
          event.preventDefault();
          const from = draggedIdRef.current;
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
          draggedIdRef.current = null;
        });
      }
    }
  }, [enabled, ensureStackIds]);

  const moveSelected = React.useCallback(
    (side: "left" | "right") => {
      const stacks = ensureStackIds();
      const selectedIds = stacks
        .filter((stack) => stack.querySelector('[aria-pressed="true"]'))
        .map((stack) => stack.dataset.customSortId!);
      if (selectedIds.length === 0) return;
      const selectedSet = new Set(selectedIds);
      const picked = orderRef.current.filter((id) => selectedSet.has(id));
      const rest = orderRef.current.filter((id) => !selectedSet.has(id));
      orderRef.current = side === "left" ? [...picked, ...rest] : [...rest, ...picked];
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
    applyOrder();
  }, [enabled, applyOrder]);

  React.useEffect(() => {
    const refresh = () => {
      setSettingsTarget(document.querySelector<HTMLElement>(".guandan-settings"));
      applyOrder();
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyOrder]);

  if (!settingsTarget) return null;

  return createPortal(
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
      <p>
        开启后可拖动手牌中的数字组调整位置；手机上可先选牌，再把所选数字组移到左侧或右侧。
      </p>
      {enabled && (
        <div className="guandan-actions" aria-label="自由组合牌排序操作">
          <button type="button" className="normal" onClick={() => moveSelected("left")}>
            所选牌移到左侧
          </button>
          <button type="button" className="normal" onClick={() => moveSelected("right")}>
            所选牌移到右侧
          </button>
          <button type="button" className="normal" onClick={resetOrder}>
            重置自由排序
          </button>
        </div>
      )}
    </div>,
    settingsTarget,
  );
};

export default GuandanCustomSortControls;
