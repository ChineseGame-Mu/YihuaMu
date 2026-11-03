use shengji_core::interactive::{Action, InteractiveGame};
use slog::{o, Discard, Logger};

fn logger() -> Logger {
    Logger::root(Discard, o!())
}

#[test]
fn adjusts_robot_seats_without_touching_human_player() {
    let mut game = InteractiveGame::new();
    let (human, _) = game.register("真人玩家".to_string()).unwrap();
    let log = logger();

    game.interact(Action::SetBots(3), human, &log).unwrap();
    let state = game.dump_state().unwrap();
    assert_eq!(state.propagated().players.len(), 4);
    assert_eq!(state.propagated().players.iter().filter(|p| p.name.starts_with("机器人")).count(), 3);

    game.interact(Action::SetBots(1), human, &log).unwrap();
    let state = game.dump_state().unwrap();
    assert_eq!(state.propagated().players.len(), 2);
    assert_eq!(state.propagated().players.iter().filter(|p| p.name.starts_with("机器人")).count(), 1);

    game.interact(Action::SetBots(0), human, &log).unwrap();
    assert_eq!(game.dump_state().unwrap().propagated().players.len(), 1);
}

#[test]
fn rejects_excess_robots_and_preserves_players() {
    let mut game = InteractiveGame::new();
    let (human, _) = game.register("真人甲".to_string()).unwrap();
    game.register("真人乙".to_string()).unwrap();
    let log = logger();
    assert!(game.interact(Action::SetBots(3), human, &log).is_err());
    assert_eq!(game.dump_state().unwrap().propagated().players.len(), 2);
    assert!(game.interact(Action::SetBots(4), human, &log).is_err());
}
