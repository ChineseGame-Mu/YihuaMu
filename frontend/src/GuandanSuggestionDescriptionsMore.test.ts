import {describeSuggestedCards} from './GuandanNoBeatHint';
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

describe('Guandan remaining suggestion descriptions', () => {
  test('describes ordinary and joker singles', () => {
    expect(describeSuggestedCards([suited('Nine')])).toBe('单张9');
    expect(describeSuggestedCards([joker('Small')])).toBe('单张小王');
    expect(describeSuggestedCards([joker('Big')])).toBe('单张大王');
  });

  test('describes a triple', () => {
    expect(
      describeSuggestedCards([
        suited('Nine', 'Clubs'),
        suited('Nine', 'Diamonds'),
        suited('Nine', 'Hearts'),
      ]),
    ).toBe('三张9');
  });

  test('describes consecutive triples by their high rank', () => {
    expect(
      describeSuggestedCards([
        suited('Eight', 'Clubs'),
        suited('Eight', 'Diamonds'),
        suited('Eight', 'Hearts'),
        suited('Nine', 'Clubs'),
        suited('Nine', 'Diamonds'),
        suited('Nine', 'Hearts'),
      ]),
    ).toBe('连三张（到9）');
  });
});
