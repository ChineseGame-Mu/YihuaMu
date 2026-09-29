/** Keep Guandan on this deployment's hostname and use its configured test route. */
export const guandanEntryHref = (currentHref: string): string => {
  const current = new URL(currentHref);
  return new URL("/guandan", current.origin).toString();
};
