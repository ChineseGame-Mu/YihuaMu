import {
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

describe('Guandan wildcard hint rules', () => {
  test('heart level wildcard completes an ace pair and beats kings', () => {
    const hand = [suited('Ace'), suited('Seven', 'Hearts')];
    const current = [suited('King'), suited('King', 'Diamonds')];

    expect(handCanBeat(hand, current, 'Seven')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Seven')).toEqual([0, 1]);
  });

  test('heart level wildcard completes a higher straight', () => {
    const hand = [
      suited('Six'),
      suited('Seven', 'Diamonds'),
      suited('Eight', 'Spades'),
      suited('Nine'),
      suited('Seven', 'Hearts'),
    ];
    const current = [
      suited('Five'),
      suited('Six', 'Diamonds'),
      suited('Seven', 'Spades'),
      suited('Eight'),
      suited('Nine', 'Diamonds'),
    ];

    expect(handCanBeat(hand, current, 'Seven')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Seven')).toEqual([0, 1, 2, 3, 4]);
  });

  test('heart level wildcard completes a higher four-card bomb', () => {
    const hand = [
      suited('Queen'),
      suited('Queen', 'Diamonds'),
      suited('Queen', 'Spades'),
      suited('Seven', 'Hearts'),
    ];
    const current = [
      suited('Jack'),
      suited('Jack', 'Diamonds'),
      suited('Jack', 'Spades'),
      suited('Jack', 'Hearts'),
    ];

    expect(handCanBeat(hand, current, 'Seven')).toBe(true);
    expect(findSuggestedIndexes(hand, current, 'Seven')).toEqual([0, 1, 2, 3]);
  });

  test('non-heart level card is not treated as a wildcard', () => {
    const hand = [suited('Ace'), suited('Seven', 'Spades')];
    const current = [suited('King'), suited('King', 'Diamonds')];

    expect(handCanBeat(hand, current, 'Seven')).toBe(false);
    expect(findSuggestedIndexes(hand, current, 'Seven')).toEqual([]);
  });
});
