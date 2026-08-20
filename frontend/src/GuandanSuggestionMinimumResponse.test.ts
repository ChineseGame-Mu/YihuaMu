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

describe('Guandan minimum-response suggestions', () => {
  test('chooses the smallest single that beats the table', () => {
    const hand = [suited('Ten'), suited('Jack'), suited('Queen')];

    expect(findSuggestedIndexes(hand, [suited('Nine')], 'Two')).toEqual([0]);
  });

  test('chooses the smallest pair that beats the table', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Jack', 'Clubs'),
      suited('Jack', 'Diamonds'),
    ];
    const current = [suited('Nine', 'Clubs'), suited('Nine', 'Diamonds')];

    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1]);
  });

  test('chooses the lowest beating straight when several are available', () => {
    const hand = [
      suited('Four', 'Clubs'),
      suited('Five', 'Diamonds'),
      suited('Six', 'Hearts'),
      suited('Seven', 'Spades'),
      suited('Eight', 'Clubs'),
      suited('Nine', 'Diamonds'),
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
