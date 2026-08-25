from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

frontend = Path("frontend/src/GuandanTable.tsx")
f = frontend.read_text()

f = replace_once(
    f,
    '  const totalDealSteps = playerCount > 0 ? cardsPerPlayer : 0;\n  const dealing =',
    '  const totalDealSteps = playerCount > 0 ? cardsPerPlayer : 0;\n  const effectiveTableSize = playerCount > 0 ? playerCount : requestedPlayerCount;\n  const deckSize = Math.max(108, effectiveTableSize * cardsPerPlayer);\n  const dealing =',
    "dynamic deck size",
)

f = f.replace(
    '  const [shuffleTo, setShuffleTo] = React.useState("108");',
    '  const [shuffleTo, setShuffleTo] = React.useState("108");',
    1,
)

# Keep the target default synchronized with the selected table size before a game starts.
effect_anchor = '''  React.useEffect(() => {\n    window.localStorage.setItem("guandan_hand_sort_order", handSortOrder);\n  }, [handSortOrder]);'''
effect_new = effect_anchor + '''\n\n  React.useEffect(() => {\n    if (!gameStarted) setShuffleTo(String(deckSize));\n  }, [deckSize, gameStarted]);'''
f = replace_once(f, effect_anchor, effect_new, "shuffle default effect")

# Robot controls are classic four-player only.
f = f.replace(
    'disabled={!joined || gameStarted || humanCount + count > 4}',
    'disabled={\n                    !joined ||\n                    gameStarted ||\n                    requestedPlayerCount !== 4 ||\n                    humanCount + count > 4\n                  }',
    1,
)
f = f.replace(
    '            任何已入座玩家都可在开局前选择 1 至 3 个机器人；真人与机器人合计仍为\n            4 位。',
    '            四人局可在开局前选择 1 至 3 个机器人；6至14人大桌保持真人联机，\n            不调用原四人机器人程序。',
    1,
)

# Dynamic manual-shuffle bounds.
f = f.replace('max="108"\n                          value={shuffleFrom}', 'max={deckSize}\n                          value={shuffleFrom}', 1)
f = f.replace('max="108"\n                          value={shuffleTo}', 'max={deckSize}\n                          value={shuffleTo}', 1)
f = f.replace('Number(shuffleFrom) > 108 ||', 'Number(shuffleFrom) > deckSize ||', 1)
f = f.replace('Number(shuffleTo) > 108', 'Number(shuffleTo) > deckSize', 1)

frontend.write_text(f)

backend = Path("backend/src/guandan_handler.rs")
s = backend.read_text()
s = s.replace(
    '"shuffle positions must both be between 1 and 108",',
    '"shuffle positions must both be inside the current deck",',
    1,
)
backend.write_text(s)

# Append a compact marker style to the actual stylesheet used by this frontend.
style_candidates = [Path("frontend/src/style.scss"), Path("frontend/src/style.css")]
for style in style_candidates:
    if style.exists():
        css = style.read_text()
        block = '''\n.guandan-team-marker {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 1.35rem;\n  height: 1.35rem;\n  margin-right: 0.3rem;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  font-weight: 800;\n  line-height: 1;\n}\n'''
        if ".guandan-team-marker" not in css:
            style.write_text(css + block)
        break
else:
    print("No standalone style file found; marker remains visible without extra styling")

print("14-player safety polish applied")
