import type { GuandanTributePlan } from "./guandanProtocol";

export const tributeGivers = (
  plan: GuandanTributePlan | null,
): readonly number[] => {
  if (plan === null) return [];
  return "Single" in plan ? [plan.Single.giver] : plan.Double.givers;
};

export const tributeReceivers = (
  plan: GuandanTributePlan | null,
): readonly number[] => {
  if (plan === null) return [];
  return "Single" in plan ? [plan.Single.receiver] : plan.Double.receivers;
};

export const shouldHideReturnTributeFace = (
  enabled: boolean,
  plan: GuandanTributePlan | null,
  viewerSeat: number | null,
  publicPlayer: number | null,
): boolean => {
  if (!enabled || plan === null || publicPlayer === null) return false;
  const isReturnTributeDisplay = tributeReceivers(plan).includes(publicPlayer);
  if (!isReturnTributeDisplay) return false;
  const viewerIsLosingSide =
    viewerSeat !== null && tributeGivers(plan).includes(viewerSeat);
  return !viewerIsLosingSide;
};
