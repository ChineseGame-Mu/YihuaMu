import {findSuggestedIndexes, handCanBeat} from './GuandanNoBeatHint';
import type {
  GuandanCard,
  GuandanRank,
  GuandanSuit,
} from './guandanProtocol';

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = 'Clubs',
): GuandanCard => ({Suited: {suit, rank}});

describe('Guandan bomb defense', () => {
  test('does not let an ordinary pair beat a four-card bomb', () => {
    const hand = [suited('Ace', 'Clubs'), suited('Ace', 'Diamonds')];
    const current = [
      suited('Four', 'Clubs'),
      suited('Four', 'Diamonds'),
      suited('Four', 'Hearts'),
      suited('Four', 'Spades'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(false);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([]);
  });

  test('does not let an ordinary straight beat a five-card bomb', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Jack', 'Diamonds'),
      suited('Queen', 'Hearts'),
      suited('King', 'Spades'),
      suited('Ace', 'Clubs'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
      suited('Nine', 'Spades'),
      suited('Nine', 'Clubs'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(false);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([]);
  });
});
