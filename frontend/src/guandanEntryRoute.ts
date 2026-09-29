export const guandanEntryHref = (): string => "https://yihua-mu.vercel.app/";

export const shouldRenderDedicatedGuandanEntry = (
  hostname: string,
  search: string,
): boolean => {
  const params = new URLSearchParams(search);
  // An explicit gameplay URL must reach the table, even when it carries the
  // cleanroom flag used by the standalone lobby.
  if (params.get("game") === "guandan") return false;
  if (params.get("cleanroom") === "1") return true;
  return (
    hostname === "yihua-mu.vercel.app" &&
    params.get("game") === null &&
    params.get("classic") !== "1"
  );
};
