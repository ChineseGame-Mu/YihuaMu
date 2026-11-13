// Only transient notices displace the opposite player's seat. The permanent
// public-table heading is placed separately so the resting offset stays zero.
export const GUANDAN_TOP_SEAT_NOTICE_SELECTORS = [
  ".guandan-next-round-panel",
  ".guandan-tribute-panel",
  ".guandan-notice-panel",
  ".guandan-initial-draw-mini",
] as const;

// Pure geometry contract for the opposite player's seat.
// This can be tested without a browser; visual overlap still requires runtime QA.
export type GuandanPanelBounds = {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  width: number;
  height: number;
  display: string;
  visibility: string;
};

export const calculateGuandanTopSeatOffset = (
  zone: { top: number; bottom: number; left?: number; right?: number },
  panels: readonly GuandanPanelBounds[],
): number => {
  let offset = 0;
  for (const panel of panels) {
    if (
      panel.display === "none" ||
      panel.visibility === "hidden" ||
      panel.width === 0 ||
      panel.height === 0 ||
      panel.bottom <= zone.top ||
      panel.top >= zone.bottom ||
      // Only notices crossing the central top seat may displace it. A tall
      // right-hand control panel must not push Robot 2 into the play area.
      (panel.left !== undefined &&
        panel.right !== undefined &&
        zone.left !== undefined &&
        zone.right !== undefined &&
        (panel.right <= (zone.left + zone.right) / 2 - 65 ||
          panel.left >= (zone.left + zone.right) / 2 + 65)) ||
      // Side-mounted notices must not push the top player into the table center.
      (panel.right !== undefined &&
        zone.left !== undefined &&
        panel.right <= zone.left) ||
      (panel.left !== undefined &&
        zone.right !== undefined &&
        panel.left >= zone.right)
    ) {
      continue;
    }
    offset = Math.max(offset, panel.bottom - zone.top);
  }
  return Math.ceil(offset);
};
