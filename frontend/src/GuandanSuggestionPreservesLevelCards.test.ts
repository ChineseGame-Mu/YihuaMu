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

describe('Guandan suggestion preserves level cards', () => {
  test('prefers an ordinary beating pair over a level-card pair', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('King', 'Clubs'),
      suited('King', 'Diamonds'),
    ];
    const current = [suited('Nine', 'Clubs'), suited('Nine', 'Diamonds')];

    expect(findSuggestedIndexes(hand, current, 'King')).toEqual([0, 1]);
  });

  test('prefers an ordinary beating triple over a level-card triple', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Ten', 'Hearts'),
      suited('King', 'Clubs'),
      suited('King', 'Diamonds'),
      suited('King', 'Hearts'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
    ];

    expect(findSuggestedIndexes(hand, current, 'King')).toEqual([0, 1, 2]);
  });
});
