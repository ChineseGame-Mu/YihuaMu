import html2canvas from "html2canvas";

export const createGuandanVictoryScreenshot = async (): Promise<string> => {
  const target = document.querySelector<HTMLElement>("[data-victory-capture='true']");
  if (target === null) throw new Error("胜利画面尚未显示，无法截图");
  const canvas = await html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(comma + 1)) {
    throw new Error("无法编码胜利截图");
  }
  return dataUrl.slice(comma + 1);
};
