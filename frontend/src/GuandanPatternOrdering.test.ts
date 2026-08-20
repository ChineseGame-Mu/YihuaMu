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

describe('Guandan ordinary pattern ordering', () => {
  test('compares triples by their rank', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Ten', 'Hearts'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2]);
    expect(handCanBeat(current, hand, 'Two')).toBe(false);
  });

  test('compares triple-with-pair plays by the triple rank', () => {
    const hand = [
      suited('Ten', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Ten', 'Hearts'),
      suited('Three', 'Clubs'),
      suited('Three', 'Diamonds'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
      suited('Nine', 'Hearts'),
      suited('Ace', 'Clubs'),
      suited('Ace', 'Diamonds'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3, 4]);
    expect(handCanBeat(current, hand, 'Two')).toBe(false);
  });

  test('compares consecutive pairs by their high rank', () => {
    const hand = [
      suited('Seven', 'Clubs'),
      suited('Seven', 'Diamonds'),
      suited('Eight', 'Clubs'),
      suited('Eight', 'Diamonds'),
      suited('Nine', 'Clubs'),
      suited('Nine', 'Diamonds'),
    ];
    const current = [
      suited('Six', 'Clubs'),
      suited('Six', 'Diamonds'),
      suited('Seven', 'Hearts'),
      suited('Seven', 'Spades'),
      suited('Eight', 'Hearts'),
      suited('Eight', 'Spades'),
    ];

    expect(handCanBeat(hand, current, 'Two')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Two')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(handCanBeat(current, hand, 'Two')).toBe(false);
  });
});
