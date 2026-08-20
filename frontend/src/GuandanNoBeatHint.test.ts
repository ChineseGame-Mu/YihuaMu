import {
  describeSuggestedCards,
  findSuggestedIndexes,
  handCanBeat,
} from './GuandanNoBeatHint';
import type {
  GuandanCard,
  GuandanRank,
  GuandanSuit,
} from './guandanProtocol';

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = 'Clubs',
): GuandanCard => ({Suited: {suit, rank}});

const joker = (value: 'Small' | 'Big'): GuandanCard => ({Joker: value});

describe('Guandan play suggestion strategy', () => {
  test('uses the smallest same-pattern play that beats the table', () => {
    const hand = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Jack', 'Clubs'),
      suited('Jack', 'Diamonds'),
    ];
    const current = [suited('Eight', 'Clubs'), suited('Eight', 'Diamonds')];

    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1]);
  });

  test('does not break a bomb when another ordinary card can beat', () => {
    const hand = [
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
      suited('Nine', 'Clubs'),
    ];

    expect(findSuggestedIndexes(hand, [suited('Seven')], 'Two')).toEqual([4]);
  });

  test('preserves the level card when a non-level card can beat', () => {
    const hand = [suited('Ten'), suited('Jack')];

    expect(findSuggestedIndexes(hand, [suited('Nine')], 'Ten')).toEqual([1]);
  });

  test('uses the smallest bomb only when no ordinary play can beat', () => {
    const hand = [
      suited('Four', 'Clubs'),
      suited('Four', 'Diamonds'),
      suited('Four', 'Hearts'),
      suited('Four', 'Spades'),
      suited('Six', 'Clubs'),
      suited('Six', 'Diamonds'),
      suited('Six', 'Hearts'),
      suited('Six', 'Spades'),
    ];
    const current = [suited('Ace', 'Clubs'), suited('Ace', 'Diamonds')];

    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3]);
  });
});

describe('Guandan bomb escalation suggestions', () => {
  test('uses a seven-card bomb to beat a six-card bomb', () => {
    const hand = [
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
      suited('Nine', 'Spades'),
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
    ];

    const indexes = findSuggestedIndexes(hand, current, 'Two');

    expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(describeSuggestedCards(indexes.map((index) => hand[index]))).toBe(
      '7炸8',
    );
  });

  test('does not claim a five-card bomb can beat a six-card bomb', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Ten', 'Hearts'),
      suited('Ten', 'Spades'),
      suited('Ten', 'Clubs'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
      suited('Nine', 'Spades'),
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(false);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([]);
  });

  test('uses a six-card bomb to beat a straight flush', () => {
    const hand = [
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
    ];
    const current = [
      suited('Seven', 'Hearts'),
      suited('Eight', 'Hearts'),
      suited('Nine', 'Hearts'),
      suited('Ten', 'Hearts'),
      suited('Jack', 'Hearts'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('does not let a five-card bomb beat a straight flush', () => {
    const hand = [
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
      suited('Eight', 'Clubs'),
    ];
    const current = [
      suited('Seven', 'Hearts'),
      suited('Eight', 'Hearts'),
      suited('Nine', 'Hearts'),
      suited('Ten', 'Hearts'),
      suited('Jack', 'Hearts'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(false);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([]);
  });

  test('compares equal-size ordinary bombs by rank', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Ten', 'Hearts'),
      suited('Ten', 'Spades'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
      suited('Nine', 'Spades'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3]);
  });

  test('treats the active level bomb as higher than an ordinary equal-size bomb', () => {
    const levelBomb = [
      suited('Six', 'Clubs'),
      suited('Six', 'Diamonds'),
      suited('Six', 'Hearts'),
      suited('Six', 'Spades'),
    ];
    const aceBomb = [
      suited('Ace', 'Clubs'),
      suited('Ace', 'Diamonds'),
      suited('Ace', 'Hearts'),
      suited('Ace', 'Spades'),
    ];

    expect(handCanBeat(levelBomb, aceBomb, 'Six')).toBe(true);
    expect(findSuggestedIndexes(levelBomb, aceBomb, 'Six')).toEqual([0, 1, 2, 3]);
    expect(handCanBeat(aceBomb, levelBomb, 'Six')).toBe(false);
    expect(findSuggestedIndexes(aceBomb, levelBomb, 'Six')).toEqual([]);
  });

  test('compares straight flushes by their high card', () => {
    const aceHigh = [
      suited('Ten', 'Hearts'),
      suited('Jack', 'Hearts'),
      suited('Queen', 'Hearts'),
      suited('King', 'Hearts'),
      suited('Ace', 'Hearts'),
    ];
    const kingHigh = [
      suited('Nine', 'Spades'),
      suited('Ten', 'Spades'),
      suited('Jack', 'Spades'),
      suited('Queen', 'Spades'),
      suited('King', 'Spades'),
    ];

    expect(handCanBeat(aceHigh, kingHigh, 'Two')).toBe(true);
    expect(findSuggestedIndexes(aceHigh, kingHigh, 'Two')).toEqual([0, 1, 2, 3, 4]);
    expect(handCanBeat(kingHigh, aceHigh, 'Two')).toBe(false);
    expect(findSuggestedIndexes(kingHigh, aceHigh, 'Two')).toEqual([]);
  });

  test('does not let any ordinary bomb beat a joker bomb', () => {
    const hand = [
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
    ];
    const current = [
      joker('Small'),
      joker('Small'),
      joker('Big'),
      joker('Big'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(false);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([]);
  });

  test('uses a joker bomb to beat a long same-rank bomb', () => {
    const hand = [
      joker('Small'),
      joker('Small'),
      joker('Big'),
      joker('Big'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
      suited('Nine', 'Spades'),
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
    ];

    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3]);
  });
});

describe('Guandan no-beat decisions', () => {
  test('returns false when no same-pattern play or bomb can beat', () => {
    const hand = [suited('Seven'), suited('Eight')];

    expect(handCanBeat(hand, [suited('Nine')], 'Two')).toBe(false);
  });

  test('returns true when an ordinary same-pattern play can beat', () => {
    const hand = [suited('Ten'), suited('Jack')];

    expect(handCanBeat(hand, [suited('Nine')], 'Two')).toBe(true);
  });

  test('returns true when only a bomb can beat a non-bomb play', () => {
    const hand = [
      suited('Four', 'Clubs'),
      suited('Four', 'Diamonds'),
      suited('Four', 'Hearts'),
      suited('Four', 'Spades'),
    ];
    const current = [suited('Ace', 'Clubs'), suited('Ace', 'Diamonds')];

    expect(handCanBeat(hand, current, 'Two')).toBe(true);
  });
});

describe('Guandan suggestion descriptions', () => {
  test('describes a pair', () => {
    expect(
      describeSuggestedCards([
        suited('Nine', 'Clubs'),
        suited('Nine', 'Diamonds'),
      ]),
    ).toBe('对9');
  });

  test('describes a straight by its high card', () => {
    expect(
      describeSuggestedCards([
        suited('Seven', 'Clubs'),
        suited('Eight', 'Diamonds'),
        suited('Nine', 'Hearts'),
        suited('Ten', 'Spades'),
        suited('Jack', 'Clubs'),
      ]),
    ).toBe('顺子（到J）');
  });

  test('describes a straight flush by its high card', () => {
    expect(
      describeSuggestedCards([
        suited('Seven', 'Hearts'),
        suited('Eight', 'Hearts'),
        suited('Nine', 'Hearts'),
        suited('Ten', 'Hearts'),
        suited('Jack', 'Hearts'),
      ]),
    ).toBe('同花顺（到J）');
  });

  test('describes consecutive pairs by their high rank', () => {
    expect(
      describeSuggestedCards([
        suited('Seven', 'Clubs'),
        suited('Seven', 'Diamonds'),
        suited('Eight', 'Clubs'),
        suited('Eight', 'Diamonds'),
        suited('Nine', 'Clubs'),
        suited('Nine', 'Diamonds'),
      ]),
    ).toBe('连对（到9）');
  });

  test('describes triple with pair by the triple rank', () => {
    expect(
      describeSuggestedCards([
        suited('Nine', 'Clubs'),
        suited('Nine', 'Diamonds'),
        suited('Nine', 'Hearts'),
        suited('Jack', 'Clubs'),
        suited('Jack', 'Diamonds'),
      ]),
    ).toBe('三带二（9）');
  });

  test('describes a four-card bomb', () => {
    expect(
      describeSuggestedCards([
        suited('Four', 'Clubs'),
        suited('Four', 'Diamonds'),
        suited('Four', 'Hearts'),
        suited('Four', 'Spades'),
      ]),
    ).toBe('4炸4');
  });

  test('describes a joker bomb', () => {
    expect(
      describeSuggestedCards([
        joker('Small'),
        joker('Small'),
        joker('Big'),
        joker('Big'),
      ]),
    ).toBe('王炸');
  });
});

describe('Guandan suggestion interaction contract', () => {
  test('keeps suggested selection and description in sync', () => {
    const hand = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Jack', 'Clubs'),
      suited('Jack', 'Diamonds'),
    ];
    const current = [suited('Eight', 'Clubs'), suited('Eight', 'Diamonds')];

    const indexes = findSuggestedIndexes(hand, current, 'Two');
    const suggestedCards = indexes.map((index) => hand[index]);

    expect(indexes).toEqual([0, 1]);
    expect(describeSuggestedCards(suggestedCards)).toBe('对9');
  });
});
