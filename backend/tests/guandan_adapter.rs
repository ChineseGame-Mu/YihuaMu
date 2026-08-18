#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;
#[path = "../src/serving_types.rs"]
mod serving_types;

#[test]
fn guandan_backend_adapter_compiles_on_current_master() {
    let state = guandan_serving_types::GuandanGameState::default();
    assert_eq!(state.hand_counts(), Vec::<usize>::new());
    assert!(!state.normal_play_blocked());

    let _room = guandan_serving_types::new_guandan_room(b"clean-sync".to_vec());
}
