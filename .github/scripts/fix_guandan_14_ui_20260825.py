from pathlib import Path

TABLE = Path('frontend/src/GuandanTable.tsx')
CSS = Path('frontend/src/guandan-approved-layout.css')

text = TABLE.read_text()
old = '''            <div
              className="guandan-participant-names"
              role="status"
              aria-label="参赛玩家"
            >
              <strong>参赛玩家：</strong>
              {state.players.length === 0
                ? "等待玩家加入"
                : state.players.join(" ｜ ")}
            </div>'''
new = '''            <div
              className="guandan-participant-names"
              role="status"
              aria-label="参赛玩家"
            >
              <strong>参赛玩家：</strong>
              <span className="guandan-participant-list">
                {state.players.length === 0
                  ? "等待玩家加入"
                  : state.players.map((player, index) => (
                      <span
                        className="guandan-participant-entry"
                        key={`participant-${index}-${player}`}
                      >
                        <span
                          className="guandan-participant-team"
                          aria-label={`队伍 ${index % 2 === 0 ? 1 : 2}`}
                        >
                          {index % 2 === 0 ? "1" : "2"}
                        </span>
                        <span>{player}</span>
                      </span>
                    ))}
              </span>
            </div>'''
if old not in text:
    raise SystemExit('participant block not found')
text = text.replace(old, new, 1)

observer_old = '''          {observing && (
            <section className="guandan-observer-notice" role="status">
              您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。
            </section>
          )}'''
observer_new = '''          {observing && (
            <section className="guandan-observer-notice" role="status">
              您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。
              {testMode && requestedPlayerCount > 4 && state.maximumPlayers !== null && state.maximumPlayers < requestedPlayerCount && (
                <strong className="guandan-test-backend-mismatch">
                  当前测试页仍连接{state.maximumPlayers}人后端；请使用14人独立测试后端链接。
                </strong>
              )}
            </section>
          )}'''
if observer_old not in text:
    raise SystemExit('observer block not found')
text = text.replace(observer_old, observer_new, 1)

TABLE.write_text(text)

css = CSS.read_text()
marker = '/* 14-player UI repair 2026-08-25 */'
if marker not in css:
    css += r'''

/* 14-player UI repair 2026-08-25 */
html body .guandan-table:has(.guandan-public-zone) .guandan-participant-names {
  display: flex !important;
  align-items: flex-start !important;
  gap: 6px !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 0 3px !important;
  line-height: 1.25 !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-participant-names > strong {
  flex: 0 0 auto !important;
  white-space: nowrap !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-participant-list {
  display: flex !important;
  flex: 1 1 auto !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 3px 8px !important;
  min-width: 0 !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-participant-entry {
  display: inline-flex !important;
  align-items: center !important;
  gap: 3px !important;
  white-space: nowrap !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-participant-team {
  display: inline-grid !important;
  width: 18px !important;
  height: 18px !important;
  place-items: center !important;
  border: 1px solid #d5a438 !important;
  border-radius: 50% !important;
  background: #fff3b9 !important;
  color: #214d39 !important;
  font-size: 11px !important;
  font-weight: 950 !important;
  line-height: 1 !important;
}

html body .guandan-table:has(.guandan-public-zone) > .guandan-observer-notice {
  grid-column: 2 !important;
  grid-row: 2 / 4 !important;
  align-self: stretch !important;
  box-sizing: border-box !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  border-left: 0 !important;
  border-radius: 0 0 14px 0 !important;
  overflow: auto !important;
}

html body .guandan-test-backend-mismatch {
  display: block !important;
  margin-top: 12px !important;
  padding: 8px !important;
  border: 2px solid #b85035 !important;
  border-radius: 8px !important;
  background: #fff0e8 !important;
  color: #8a2e1c !important;
}

html body .guandan-table:has(.guandan-public-zone) > .guandan-private-zone > .guandan-hand-section {
  align-self: stretch !important;
  min-height: 0 !important;
}

html body .guandan-table:has(.guandan-public-zone) > .guandan-private-zone > section.guandan-play-actions {
  align-self: stretch !important;
  min-height: 0 !important;
  height: 100% !important;
}
'''
CSS.write_text(css)
print('GUANDAN_14_UI_PATCH_OK')
