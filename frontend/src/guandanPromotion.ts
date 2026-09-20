export type GuandanPromotionSteps = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const supportedPlayerCounts = new Set([4, 6, 8, 10, 12, 14]);

export const guandanPromotionSteps = (
  finishOrder: readonly number[],
): GuandanPromotionSteps | null => {
  const playerCount = finishOrder.length;
  const winner = finishOrder[0];
  if (!supportedPlayerCounts.has(playerCount) || winner === undefined)
    return null;
  if (
    new Set(finishOrder).size !== playerCount ||
    finishOrder.some(
      (seat) => !Number.isInteger(seat) || seat < 0 || seat >= playerCount,
    )
  ) {
    return null;
  }

  const winnerParity = winner % 2;
  const winnerPlaces = finishOrder
    .map((seat, index) => ({ seat, place: index + 1 }))
    .filter(({ seat }) => seat % 2 === winnerParity)
    .map(({ place }) => place);
  const key = winnerPlaces.join(",");

  if (playerCount === 4) {
    return winnerPlaces[1] === 2 ? 3 : winnerPlaces[1] === 3 ? 2 : 1;
  }
  if (playerCount === 6) {
    if (key === "1,2,3") return 4;
    if (key === "1,2,4") return 3;
    if (key === "1,2,5" || key === "1,3,4") return 2;
    return 1;
  }
  if (playerCount === 8) {
    if (key === "1,2,3,4") return 5;
    if (key === "1,2,3,5") return 4;
    if (key === "1,2,3,6" || key === "1,2,4,5") return 3;
    if (key === "1,2,3,7" || key === "1,2,4,6" || key === "1,3,4,5") {
      return 2;
    }
    return 1;
  }

  const leadingHalf = playerCount / 2;
  const leadingHalfWinners = winnerPlaces.filter(
    (place) => place <= leadingHalf,
  ).length;
  return (
    leadingHalfWinners === leadingHalf ? leadingHalf + 1 : leadingHalfWinners
  ) as GuandanPromotionSteps;
};
