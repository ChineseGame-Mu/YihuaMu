import {findSuggestedIndexes} from './GuandanNoBeatHint';
import type {
  GuandanCard,
  GuandanRank,
  GuandanSuit,
} from './guandanProtocol';

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = 'Clubs',
): GuandanCard => ({Suited: {suit, rank}});

describe('Guandan suggestion preserves bombs', () => {
  test('prefers a beating pair over spending a four-card bomb', () => {
    const hand = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('King', 'Clubs'),
      suited('King', 'Diamonds'),
      suited('King', 'Hearts'),
      suited('King', 'Spades'),
    ];
    const current = [suited('Eight', 'Clubs'), suited('Eight', 'Diamonds')];

    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1]);
  });

  test('prefers a beating straight over spending a six-card bomb', () => {
    const hand = [
      suited('Four', 'Clubs'),
      suited('Five', 'Diamonds'),
      suited('Six', 'Hearts'),
      suited('Seven', 'Spades'),
      suited('Eight', 'Clubs'),
      suited('King', 'Clubs'),
      suited('King', 'Diamonds'),
      suited('King', 'Hearts'),
      suited('King', 'Spades'),
      suited('King', 'Clubs'),
      suited('King', 'Diamonds'),
    ];
    const current = [
      suited('Three', 'Clubs'),
      suited('Four', 'Diamonds'),
      suited('Five', 'Hearts'),
      suited('Six', 'Spades'),
      suited('Seven', 'Clubs'),
    ];

    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3, 4]);
  });
});
