import {findSuggestedIndexes} from './GuandanNoBeatHint';
import type {GuandanCard, GuandanRank, GuandanSuit} from './guandanProtocol';

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = 'Clubs',
): GuandanCard => ({Suited: {suit, rank}});

describe('Guandan play suggestion strategy', () => {
  test('uses the smallest same-pattern play that beats the table', () => {
    const hand = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Jack', 'Clubs'),
      suited('Jack', 'Diamonds'),
    ];
    const current = [
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
    ];

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
