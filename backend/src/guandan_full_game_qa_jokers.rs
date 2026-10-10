fn qa_place_big_jokers(hands: &mut [Vec<CardFace>], target: usize) {
    for _ in 0..2 {
        if hands[target].iter()
            .filter(|card| matches!(card, CardFace::Joker(Joker::Big)))
            .count() == 2 { return; }
        let source = (0..hands.len()).find(|seat| {
            *seat != target && hands[*seat].iter()
                .any(|card| matches!(card, CardFace::Joker(Joker::Big)))
        }).expect("two big jokers in full deck");
        let from = hands[source].iter()
            .position(|card| matches!(card, CardFace::Joker(Joker::Big))).unwrap();
        let to = hands[target].iter()
            .position(|card| !matches!(card, CardFace::Joker(Joker::Big))).unwrap();
        let displaced = hands[target][to];
        hands[target][to] = hands[source][from];
        hands[source][from] = displaced;
    }
    assert_eq!(hands[target].iter()
        .filter(|card| matches!(card, CardFace::Joker(Joker::Big))).count(), 2);
}
