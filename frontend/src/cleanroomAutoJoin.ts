export const shouldAutoJoinCleanroom = (search: string): boolean => {
  const params = new URLSearchParams(search);
  const room = params.get("room") ?? params.get("cleanroomRoom");
  return (
    params.get("autoJoin") !== "0" &&
    params.get("cleanroom") === "1" &&
    params.get("game") === "guandan" &&
    room !== null &&
    room.trim() !== "" &&
    (params.get("name") ?? params.get("playerName") ?? "").trim() !== ""
  );
};
