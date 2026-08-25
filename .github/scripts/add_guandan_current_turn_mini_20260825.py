from pathlib import Path

TABLE = Path('frontend/src/GuandanTable.tsx')
CSS = Path('frontend/src/guandan-approved-layout.css')

text = TABLE.read_text()
marker = 'className="guandan-current-turn-mini"'
if marker not in text:
    anchor = '''      {state.error !== null && (\n        <p role="alert">{guandanErrorLabel(state.error)}</p>\n      )}'''
    block = '''      {joined &&\n        !observing &&\n        gameStarted &&\n        !dealing &&\n        !nextRoundPending &&\n        !tributePending &&\n        !state.trickComplete &&\n        effectiveTurn !== null && (\n          <div\n            className="guandan-current-turn-mini"\n            role="status"\n            aria-label="当前应出牌玩家"\n          >\n            <span>当前应出牌：</span>\n            <strong>\n              {state.players[effectiveTurn] ?? `玩家${effectiveTurn + 1}`}\n            </strong>\n          </div>\n        )}\n\n'''
    if anchor not in text:
        raise SystemExit('turn display anchor not found')
    text = text.replace(anchor, block + anchor, 1)
    TABLE.write_text(text)

css = CSS.read_text()
css_marker = '/* current-turn mini display 2026-08-25 */'
if css_marker not in css:
    css += r'''

/* current-turn mini display 2026-08-25 */
html body .guandan-current-turn-mini {
  position: fixed !important;
  z-index: 120 !important;
  left: 14px !important;
  bottom: 58px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  box-sizing: border-box !important;
  min-width: 150px !important;
  padding: 7px 11px !important;
  border: 2px solid #d5a438 !important;
  border-radius: 9px !important;
  background: rgba(255, 250, 220, 0.97) !important;
  color: #174331 !important;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.24) !important;
  font-size: 14px !important;
  line-height: 1.1 !important;
  pointer-events: none !important;
}

html body .guandan-current-turn-mini strong {
  font-size: 16px !important;
  font-weight: 950 !important;
  color: #9a2d1e !important;
}
'''
    CSS.write_text(css)

print('GUANDAN_CURRENT_TURN_MINI_OK')
