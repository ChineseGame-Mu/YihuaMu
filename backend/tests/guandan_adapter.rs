#[path = "../src/serving_types.rs"]
mod serving_types;
#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;

#[test]
fn guandan_backend_adapter_compiles_on_current_master() {
    let room = guandan_serving_types::new_guandan_room(b"clean-sync".to_vec());
    assert_eq!(room.game.hand_counts(), Vec::<usize>::new());
    assert!(!room.game.normal_play_blocked());
}
