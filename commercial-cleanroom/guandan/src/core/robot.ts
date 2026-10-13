export const ROBOT_MIN_DELAY_MS = 800;
export const ROBOT_MAX_DELAY_MS = 1800;

export const robotDelayMs = (random: () => number = Math.random): number => {
  const sample = random();
  if (sample < 0 || sample >= 1 || !Number.isFinite(sample)) {
    throw new Error("random source must return a finite value in [0, 1)");
  }
  const range = ROBOT_MAX_DELAY_MS - ROBOT_MIN_DELAY_MS + 1;
  return ROBOT_MIN_DELAY_MS + Math.floor(sample * range);
};
