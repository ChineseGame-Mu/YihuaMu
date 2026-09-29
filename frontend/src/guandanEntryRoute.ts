export const guandanEntryHref = (): string => "https://yihua-mu.vercel.app/";

export const shouldRenderDedicatedGuandanEntry = (
  hostname: string,
  search: string,
): boolean => {
  const params = new URLSearchParams(search);
  // A deep link to a live game must render the table even if the entry flag
  // is present on the dedicated-site URL.
  if (params.get("game") === "guandan") return false;
  if (params.get("cleanroom") === "1") return true;
  return (
    hostname === "yihua-mu.vercel.app" &&
    params.get("game") === null &&
    params.get("classic") !== "1"
  );
};
