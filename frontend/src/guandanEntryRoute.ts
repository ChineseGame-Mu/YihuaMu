export const guandanEntryHref = (): string => "https://yihua-mu.vercel.app/";

export const shouldRenderDedicatedGuandanEntry = (
  hostname: string,
  search: string,
): boolean => {
  const params = new URLSearchParams(search);
  if (params.get("cleanroom") === "1") return true;
  return (
    hostname === "yihua-mu.vercel.app" &&
    params.get("game") === null &&
    params.get("classic") !== "1"
  );
};
