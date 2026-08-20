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

describe('Guandan straight rules', () => {
  test('accepts A-2-3-4-5 as the minimum straight and ranks it five-high', () => {
    const aceLow = [
      suited('Ace', 'Clubs'),
      suited('Two', 'Diamonds'),
      suited('Three', 'Hearts'),
      suited('Four', 'Spades'),
      suited('Five', 'Clubs'),
    ];
    const sixHigh = [
      suited('Two', 'Clubs'),
      suited('Three', 'Diamonds'),
      suited('Four', 'Hearts'),
      suited('Five', 'Spades'),
      suited('Six', 'Clubs'),
    ];

    expect(describeSuggestedCards(aceLow)).toBe('顺子（到5）');
    expect(handCanBeat(aceLow, sixHigh, 'Nine')).toBe(false);
    expect(handCanBeat(sixHigh, aceLow, 'Nine')).toBe(true);
  });

  test('keeps 10-J-Q-K-A as the highest ordinary straight', () => {
    const aceHigh = [
      suited('Ten', 'Clubs'),
      suited('Jack', 'Diamonds'),
      suited('Queen', 'Hearts'),
      suited('King', 'Spades'),
      suited('Ace', 'Clubs'),
    ];
    const kingHigh = [
      suited('Nine', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Jack', 'Hearts'),
      suited('Queen', 'Spades'),
      suited('King', 'Clubs'),
    ];

    expect(handCanBeat(aceHigh, kingHigh, 'Three')).toBe(true);
    expect(handCanBeat(kingHigh, aceHigh, 'Three')).toBe(false);
  });

  test('rejects J-Q-K-A-2 wraparound straight', () => {
    const wraparound = [
      suited('Jack', 'Clubs'),
      suited('Queen', 'Diamonds'),
      suited('King', 'Hearts'),
      suited('Ace', 'Spades'),
      suited('Two', 'Clubs'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Jack', 'Hearts'),
      suited('Queen', 'Spades'),
      suited('King', 'Clubs'),
    ];

    expect(describeSuggestedCards(wraparound)).toBeNull();
    expect(findSuggestedIndexes(wraparound, current, 'Two')).toEqual([]);
  });

  test('rejects J-Q-K-A-level-card wraparound for every level', () => {
    const base = [
      suited('Jack', 'Clubs'),
      suited('Queen', 'Diamonds'),
      suited('King', 'Hearts'),
      suited('Ace', 'Spades'),
    ];
    const current = [
      suited('Nine', 'Clubs'),
      suited('Ten', 'Diamonds'),
      suited('Jack', 'Hearts'),
      suited('Queen', 'Spades'),
      suited('King', 'Clubs'),
    ];

    for (const level of ['Three', 'Seven', 'Ten'] as GuandanRank[]) {
      const wraparound = [...base, suited(level, 'Clubs')];
      expect(describeSuggestedCards(wraparound)).toBeNull();
      expect(findSuggestedIndexes(wraparound, current, level)).toEqual([]);
    }
  });
});
