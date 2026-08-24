use std::{fs, path::Path};

fn replace_once(text: &mut String, from: &str, to: &str) {
    if text.contains(to) {
        return;
    }
    if let Some(index) = text.find(from) {
        text.replace_range(index..index + from.len(), to);
    } else {
        panic!("Guandan round-state patch anchor not found");
    }
}

fn main() {
    let path = Path::new("src/guandan_handler.rs");
    let mut text = fs::read_to_string(path).expect("read guandan_handler.rs");

    replace_once(
        &mut text,
        "fn settle_and_redeal_if_complete(game: &mut GuandanGameState) -> Result<bool, &'static str> {\n    let active_players = game.hands.iter().filter(|hand| !hand.is_empty()).count();\n    if active_players > 0 || game.finish_order.is_empty() {\n        return Ok(false);\n    }\n\n    let player_count = game.hands.len();\n    if player_count != GUANDAN_PLAYER_COUNT {\n        return Err(\"Guandan settlement requires exactly four players\");\n    }\n    if game.finish_order.len() != player_count {\n        return Err(\"Guandan settlement requires a complete finish order\");\n    }\n    let previous_finish_order = game.finish_order.clone();\n",
        "fn settle_and_redeal_if_complete(game: &mut GuandanGameState) -> Result<bool, &'static str> {\n    let player_count = game.hands.len();\n    if player_count != GUANDAN_PLAYER_COUNT {\n        return Err(\"Guandan settlement requires exactly four players\");\n    }\n\n    if game.finish_order.len() == player_count - 1 {\n        let last_seat = (0..player_count)\n            .find(|seat| !game.finish_order.contains(seat))\n            .ok_or(\"unable to determine fourth place\")?;\n        game.finish_order.push(last_seat);\n        game.hands[last_seat].clear();\n    }\n\n    let active_players = game.hands.iter().filter(|hand| !hand.is_empty()).count();\n    if active_players > 0 || game.finish_order.is_empty() {\n        return Ok(false);\n    }\n    if game.finish_order.len() != player_count {\n        return Err(\"Guandan settlement requires a complete finish order\");\n    }\n    let previous_finish_order = game.finish_order.clone();\n",
    );

    replace_once(
        &mut text,
        "    game.passes = 0;\n    game.trick_complete = false;\n    game.pending_tribute = None;\n",
        "    game.passes = 0;\n    game.trick_complete = false;\n    game.last_trick_winner = None;\n    game.pending_tribute = None;\n",
    );

    fs::write(path, text).expect("write guandan_handler.rs");
    println!("cargo:rerun-if-changed=build.rs");
}
