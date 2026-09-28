import type { GuandanTeam } from "./guandanProtocol";

interface VictoryScreenshotInput {
  winnerTeam: GuandanTeam;
  players: string[];
  finishOrder: number[];
  room: string;
}

const escapeXml = (value: string): string =>
  value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character] ?? character;
  });

const playerName = (players: string[], seat: number): string =>
  players[seat] ?? `玩家${seat + 1}`;

const svgText = (
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 600,
): string =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(text)}</text>`;

const loadSvgImage = (svg: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法生成胜利截图"));
    };
    image.src = url;
  });

export const createGuandanVictoryScreenshot = async (
  input: VictoryScreenshotInput,
): Promise<string> => {
  const width = 1600;
  const height = 1000;
  const winningParity = input.winnerTeam === "A" ? 0 : 1;
  const leadingTeam = input.finishOrder.slice(0, input.players.length / 2);
  const hasDoubleUp =
    leadingTeam.length === input.players.length / 2 &&
    leadingTeam.every((seat) => seat % 2 === winningParity);
  const winners = hasDoubleUp
    ? leadingTeam
    : input.finishOrder.filter((seat) => seat % 2 === winningParity);
  const winnerLines = winners
    .map((seat, index) =>
      svgText(
        `第${input.finishOrder.indexOf(seat) + 1}名  ${playerName(input.players, seat)}`,
        width / 2,
        495 + index * 74,
        42,
        "#fff8dc",
      ),
    )
    .join("");
  const opponents = hasDoubleUp
    ? input.finishOrder
        .filter((seat) => seat % 2 !== winningParity)
        .map((seat) => playerName(input.players, seat))
        .join("、")
    : "";
  const date = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <radialGradient id="felt"><stop stop-color="#358b58"/><stop offset="1" stop-color="#0b432d"/></radialGradient>
      <linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff0ae"/><stop offset="1" stop-color="#d2a640"/></linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#00180d" flood-opacity=".45"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#felt)"/>
    <rect x="35" y="35" width="1530" height="930" rx="42" fill="none" stroke="url(#gold)" stroke-width="8"/>
    <rect x="115" y="95" width="1370" height="810" rx="36" fill="#0b3828" fill-opacity=".73" stroke="#f4d47c" stroke-opacity=".65" stroke-width="3" filter="url(#shadow)"/>
    ${svgText("掼蛋 · A级胜利", 800, 190, 58, "#ffe49a", 800)}
    ${svgText(`${input.winnerTeam}队获胜！`, 800, 315, 94, "#fff2c5", 800)}
    ${svgText("恭喜打A成功", 800, 400, 44, "#e8cc7c", 700)}
    ${winnerLines}
    ${hasDoubleUp ? svgText(`双下（并列）：${opponents}`, 800, 760, 34, "#d9e8d7") : ""}
    ${svgText(`房间 ${input.room}   ·   ${date}`, 800, 850, 28, "#c4d7c6", 500)}
  </svg>`;
  const image = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("浏览器无法创建截图");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
};
