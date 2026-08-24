import * as React from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "guandan_custom_hand_sort_enabled";
const CUSTOM_STACK_KEY = "guandan_custom_stack_mode_enabled";

type Side = "left" | "right";

const GuandanCustomSortControls: React.FunctionComponent = () => {
  const [enabled, setEnabled] = React.useState(
    () => window.localStorage.getItem(STORAGE_KEY) === "on",
  );
  const [customStackMode, setCustomStackMode] = React.useState(
    () => window.localStorage.getItem(CUSTOM_STACK_KEY) === "on",
  );
  const [settingsTarget, setSettingsTarget] =
    React.useState<HTMLElement | null>(null);
  const [privateZoneTarget, setPrivateZoneTarget] =
    React.useState<HTMLElement | null>(null);

  const nextIdRef = React.useRef(1);
  const nextGroupIdRef = React.useRef(1);
  const stackOrderRef = React.useRef<string[]>([]);
  const cardOrderRef = React.useRef<string[]>([]);
  const cardGroupsRef = React.useRef<Map<string, string>>(new Map());
  const draggedStackIdRef = React.useRef<string | null>(null);
  const draggedCardIdRef = React.useRef<string | null>(null);
  const bulkClickRef = React.useRef(false);
  const customStackModeRef = React.useRef(customStackMode);

  React.useEffect(() => {
    customStackModeRef.current = customStackMode;
  }, [customStackMode]);

  const stacks = React.useCallback(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".guandan-hand .guandan-card-stack",
        ),
      ),
    [],
  );

  const buttons = React.useCallback(
    () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".guandan-hand .guandan-card-stack > button",
        ),
      ),
    [],
  );

  const ensureIds = React.useCallback(() => {
    const currentStacks = stacks();
    for (const stack of currentStacks) {
      if (!stack.dataset.customSortId) {
        stack.dataset.customSortId = `custom-stack-${nextIdRef.current++}`;
      }
    }
    const liveStackIds = currentStacks.map(
      (stack) => stack.dataset.customSortId!,
    );
    stackOrderRef.current = [
      ...stackOrderRef.current.filter((id) => liveStackIds.includes(id)),
      ...liveStackIds.filter((id) => !stackOrderRef.current.includes(id)),
    ];

    const currentButtons = buttons();
    for (const button of currentButtons) {
      if (!button.dataset.customCardId) {
        button.dataset.customCardId = `custom-card-${nextIdRef.current++}`;
      }
    }
    const liveCardIds = currentButtons.map(
      (button) => button.dataset.customCardId!,
    );
    cardOrderRef.current = [
      ...cardOrderRef.current.filter((id) => liveCardIds.includes(id)),
      ...liveCardIds.filter((id) => !cardOrderRef.current.includes(id)),
    ];
    for (const id of Array.from(cardGroupsRef.current.keys())) {
      if (!liveCardIds.includes(id)) cardGroupsRef.current.delete(id);
    }
    return { currentStacks, currentButtons };
  }, [buttons, stacks]);

  const normalizeGroups = React.useCallback(() => {
    const counts = new Map<string, number>();
    for (const group of Array.from(cardGroupsRef.current.values())) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    for (const [id, group] of Array.from(cardGroupsRef.current.entries())) {
      if ((counts.get(group) ?? 0) < 2) cardGroupsRef.current.delete(id);
    }
  }, []);

  const applyLayout = React.useCallback(() => {
    const hand = document.querySelector<HTMLElement>(".guandan-hand");
    const { currentStacks, currentButtons } = ensureIds();
    if (!hand) return;

    hand.classList.toggle("guandan-custom-stack-mode", customStackMode);

    const stackPositions = new Map(
      stackOrderRef.current.map((id, index) => [id, index]),
    );
    for (const stack of currentStacks) {
      const id = stack.dataset.customSortId!;
      stack.style.order =
        enabled && !customStackMode ? String(stackPositions.get(id) ?? 0) : "";
      stack.draggable = enabled && !customStackMode;
      stack.style.cursor = enabled && !customStackMode ? "grab" : "";
      // Important: custom mode must physically flatten the old rank stacks.
      // Otherwise dragging one card still leaves the rest visually grouped by rank.
      stack.style.display = customStackMode ? "contents" : "";
    }

    const cardPositions = new Map(
      cardOrderRef.current.map((id, index) => [id, index]),
    );
    for (const button of currentButtons) {
      const id = button.dataset.customCardId!;
      button.draggable = customStackMode;
      button.style.order = customStackMode
        ? String(cardPositions.get(id) ?? 0)
        : "";
      button.style.cursor = customStackMode ? "grab" : "";
      button.style.margin = customStackMode ? "0" : "";
      button.style.flex = customStackMode ? "0 0 78px" : "";
      button.classList.remove("guandan-custom-stack-member");
    }

    if (!customStackMode) return;

    const byId = new Map(
      currentButtons.map((button) => [button.dataset.customCardId!, button]),
    );
    for (let index = 0; index < cardOrderRef.current.length; index += 1) {
      const id = cardOrderRef.current[index]!;
      const button = byId.get(id);
      if (!button) continue;
      const group = cardGroupsRef.current.get(id);
      if (!group) continue;
      button.classList.add("guandan-custom-stack-member");
      const previousId = cardOrderRef.current[index - 1];
      if (previousId && cardGroupsRef.current.get(previousId) === group) {
        button.style.marginLeft = "-58px";
      }
    }
  }, [customStackMode, enabled, ensureIds]);

  const stackCardOnto = React.useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      if (!cardOrderRef.current.includes(sourceId)) return;
      if (!cardOrderRef.current.includes(targetId)) return;

      const targetGroup =
        cardGroupsRef.current.get(targetId) ??
        `custom-group-${nextGroupIdRef.current++}`;
      cardGroupsRef.current.delete(sourceId);
      cardGroupsRef.current.set(targetId, targetGroup);
      cardGroupsRef.current.set(sourceId, targetGroup);
      normalizeGroups();

      const order = cardOrderRef.current.filter((id) => id !== sourceId);
      let insertAfter = order.indexOf(targetId);
      while (
        insertAfter + 1 < order.length &&
        cardGroupsRef.current.get(order[insertAfter + 1]!) === targetGroup
      ) {
        insertAfter += 1;
      }
      order.splice(insertAfter + 1, 0, sourceId);
      cardOrderRef.current = order;
      applyLayout();
    },
    [applyLayout, normalizeGroups],
  );

  const bindEvents = React.useCallback(() => {
    const hand = document.querySelector<HTMLElement>(".guandan-hand");
    const { currentStacks, currentButtons } = ensureIds();
    if (!hand) return;

    for (const stack of currentStacks) {
      if (stack.dataset.customSortBound === "1") continue;
      stack.dataset.customSortBound = "1";
      stack.addEventListener("dragstart", (event) => {
        if (customStackModeRef.current) return;
        draggedStackIdRef.current = stack.dataset.customSortId ?? null;
        if (!draggedStackIdRef.current) event.preventDefault();
      });
      stack.addEventListener("dragover", (event) => {
        if (!customStackModeRef.current) event.preventDefault();
      });
      stack.addEventListener("drop", (event) => {
        if (customStackModeRef.current) return;
        event.preventDefault();
        const from = draggedStackIdRef.current;
        const to = stack.dataset.customSortId;
        if (!from || !to || from === to) return;
        const order = [...stackOrderRef.current];
        const fromIndex = order.indexOf(from);
        const toIndex = order.indexOf(to);
        if (fromIndex < 0 || toIndex < 0) return;
        order.splice(fromIndex, 1);
        order.splice(toIndex, 0, from);
        stackOrderRef.current = order;
        applyLayout();
      });
      stack.addEventListener("dragend", () => {
        draggedStackIdRef.current = null;
      });
    }

    for (const button of currentButtons) {
      if (button.dataset.customStackBound === "1") continue;
      button.dataset.customStackBound = "1";
      button.addEventListener("dragstart", (event) => {
        if (!customStackModeRef.current) return;
        event.stopPropagation();
        const id = button.dataset.customCardId ?? null;
        draggedCardIdRef.current = id;
        if (event.dataTransfer && id) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
        }
      });
      button.addEventListener("dragover", (event) => {
        if (!customStackModeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      button.addEventListener("drop", (event) => {
        if (!customStackModeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        const source =
          draggedCardIdRef.current || event.dataTransfer?.getData("text/plain");
        const target = button.dataset.customCardId;
        if (source && target) stackCardOnto(source, target);
      });
      button.addEventListener("dragend", (event) => {
        if (customStackModeRef.current) event.stopPropagation();
        draggedCardIdRef.current = null;
      });
    }

    if (hand.dataset.customStackClickBound === "1") return;
    hand.dataset.customStackClickBound = "1";
    hand.addEventListener(
      "click",
      (event) => {
        if (!customStackModeRef.current || bulkClickRef.current) return;
        const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
          ".guandan-card-stack > button",
        );
        if (!target) return;
        const id = target.dataset.customCardId;
        const group = id ? cardGroupsRef.current.get(id) : undefined;
        if (!group) return;
        const members = buttons().filter(
          (button) =>
            cardGroupsRef.current.get(button.dataset.customCardId ?? "") === group,
        );
        if (members.length < 2) return;

        event.preventDefault();
        event.stopPropagation();
        const allSelected = members.every(
          (member) => member.getAttribute("aria-pressed") === "true",
        );
        bulkClickRef.current = true;
        try {
          for (const member of members) {
            const pressed = member.getAttribute("aria-pressed") === "true";
            if (pressed === allSelected) member.click();
          }
        } finally {
          bulkClickRef.current = false;
        }
      },
      true,
    );
  }, [applyLayout, buttons, ensureIds, stackCardOnto]);

  const moveSelected = React.useCallback(
    (side: Side) => {
      const currentStacks = stacks();
      const selectedIds = currentStacks
        .filter((stack) => stack.querySelector('[aria-pressed="true"]'))
        .map((stack) => stack.dataset.customSortId)
        .filter((id): id is string => Boolean(id));
      if (selectedIds.length === 0) return;
      const selectedSet = new Set(selectedIds);
      const picked = stackOrderRef.current.filter((id) => selectedSet.has(id));
      const rest = stackOrderRef.current.filter((id) => !selectedSet.has(id));
      stackOrderRef.current =
        side === "left" ? [...picked, ...rest] : [...rest, ...picked];
      applyLayout();
    },
    [applyLayout, stacks],
  );

  const resetOrder = React.useCallback(() => {
    stackOrderRef.current = [];
    cardOrderRef.current = [];
    cardGroupsRef.current.clear();
    ensureIds();
    applyLayout();
  }, [applyLayout, ensureIds]);

  const splitSelectedStack = React.useCallback(() => {
    const selected = buttons().filter(
      (button) => button.getAttribute("aria-pressed") === "true",
    );
    const groups = new Set<string>();
    for (const button of selected) {
      const id = button.dataset.customCardId;
      if (!id) continue;
      const group = cardGroupsRef.current.get(id);
      if (group) groups.add(group);
    }
    for (const [id, group] of Array.from(cardGroupsRef.current.entries())) {
      if (groups.has(group)) cardGroupsRef.current.delete(id);
    }
    normalizeGroups();
    applyLayout();
  }, [applyLayout, buttons, normalizeGroups]);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    applyLayout();
  }, [enabled, applyLayout]);

  React.useEffect(() => {
    window.localStorage.setItem(
      CUSTOM_STACK_KEY,
      customStackMode ? "on" : "off",
    );
    if (!customStackMode) {
      cardGroupsRef.current.clear();
      cardOrderRef.current = [];
    }
    applyLayout();
  }, [customStackMode, applyLayout]);

  React.useEffect(() => {
    const refresh = () => {
      setSettingsTarget(
        document.querySelector<HTMLElement>(".guandan-settings"),
      );
      setPrivateZoneTarget(
        document.querySelector<HTMLElement>(".guandan-private-zone"),
      );
      bindEvents();
      applyLayout();
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyLayout, bindEvents]);

  const globalStyles = (
    <style>{`
      .guandan-stack-mode-controls {
        position: absolute;
        top: 5px;
        right: 16px;
        z-index: 8;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .guandan-stack-mode-button {
        padding: 7px 13px !important;
        border: 2px solid #f4d47c !important;
        border-radius: 10px !important;
        background: linear-gradient(180deg, #fff5c8, #e8bd58) !important;
        color: #543500 !important;
        font-size: .9rem !important;
        font-weight: 900 !important;
        box-shadow: 0 3px 7px rgb(0 0 0 / 28%) !important;
      }
      .guandan-stack-mode-button.is-on {
        border-color: #8ee7ff !important;
        background: linear-gradient(180deg, #1ca9c6, #08758c) !important;
        color: white !important;
      }
      .guandan-stack-split-button {
        padding: 7px 10px !important;
        font-size: .82rem !important;
      }
      .guandan-hand.guandan-custom-stack-mode {
        align-items: flex-end;
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack {
        display: contents !important;
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack > button {
        flex: 0 0 78px !important;
        margin: 0 !important;
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack > button.guandan-custom-stack-member {
        box-shadow: 0 4px 9px rgb(0 0 0 / 34%);
      }
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
        .guandan-stack-mode-controls {
          position: static;
          justify-content: center;
          margin: -2px 0 8px;
        }
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
                disabled={customStackMode}
                onChange={(event) => setEnabled(event.target.checked)}
              />{" "}
              玩家自由组合牌排序
            </label>
            <p>
              数字自动叠加模式下，可拖动同数字牌组调整位置；切换到自定义叠牌后，所有牌先拆成单张，再由玩家自行叠组。
            </p>
            {enabled && !customStackMode && (
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
        )}
      {privateZoneTarget &&
        createPortal(
          <div className="guandan-stack-mode-controls" aria-label="叠牌模式转换">
            <button
              type="button"
              className={`guandan-stack-mode-button ${customStackMode ? "is-on" : ""}`}
              aria-pressed={customStackMode}
              onClick={() => setCustomStackMode((current) => !current)}
              title="切换数字自动叠加与玩家自定义叠牌"
            >
              自定义叠牌：{customStackMode ? "开" : "关"}
            </button>
            {customStackMode && (
              <button
                type="button"
                className="normal guandan-stack-split-button"
                onClick={splitSelectedStack}
              >
                拆开所选
              </button>
            )}
          </div>,
          privateZoneTarget,
        )}
    </>
  );
};

export default GuandanCustomSortControls;
