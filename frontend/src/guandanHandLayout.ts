export const privateHandStackProgress = (
  stackIndex: number,
  stackSize: number,
): number => {
  if (stackSize <= 1) return 1;
  return stackIndex / (stackSize - 1);
};
