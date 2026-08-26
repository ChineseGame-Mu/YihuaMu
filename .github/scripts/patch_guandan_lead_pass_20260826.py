from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Backend: only the very first lead of a hand is forced to play.
# After the first trick has completed, an empty-table leader may pass and yield the lead.
replace_once(
    "backend/src/guandan_handler.rs",
    '''                        if state.game.normal_play_blocked()\n                            || !state.game.started\n                            || state.game.trick_complete\n                            || state.game.turn != seat\n                            || state.game.last_player.is_none()\n                        {\n                            return Err(());\n                        }\n                        state.game.passes += 1;\n                        let winner = state.game.last_player.unwrap_or(state.game.turn);''',
    '''                        let empty_table = state.game.last_player.is_none();\n                        if state.game.normal_play_blocked()\n                            || !state.game.started\n                            || state.game.trick_complete\n                            || state.game.turn != seat\n                            || (empty_table && state.game.last_trick_winner.is_none())\n                        {\n                            return Err(());\n                        }\n                        if empty_table {\n                            advance_turn(&mut state.game);\n                            run_robot_turns(&mut state.game).map_err(|_| ())?;\n                            state.bump_version();\n                            return Ok((state, vec![GuandanStorageMessage::StateChanged]));\n                        }\n                        state.game.passes += 1;\n                        let winner = state.game.last_player.unwrap_or(state.game.turn);''',
)

# Frontend: enable Pass on an empty table after at least one trick has been completed.
replace_once(
    "frontend/src/GuandanTable.tsx",
    '''                <button\n                  disabled={!gameStarted || state.lastPlayer === null}\n                  onClick={() => send({ type: "pass" })}\n                >''',
    '''                <button\n                  disabled={\n                    !gameStarted ||\n                    (state.lastPlayer === null && state.lastTrickWinner === null)\n                  }\n                  onClick={() => send({ type: "pass" })}\n                >''',
)
