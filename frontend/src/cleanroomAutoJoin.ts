export const shouldAutoJoinCleanroom = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return (
    params.get("autoJoin") === "1" &&
    params.get("cleanroom") === "1" &&
    params.get("game") === "guandan" &&
    params.get("room") !== null &&
    (params.get("name") ?? params.get("playerName") ?? "").trim() !== ""
  );
};
