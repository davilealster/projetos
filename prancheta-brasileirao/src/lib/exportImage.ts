import { toBlob } from "html-to-image";

/** Gera PNG de um elemento com 1080 px de largura. No celular tenta a Web Share API (WhatsApp/Instagram). */
export async function exportImage(el: HTMLElement, filename: string, preferShare: boolean): Promise<void> {
  const width = el.getBoundingClientRect().width;
  const blob = await toBlob(el, {
    pixelRatio: 1080 / width,
    backgroundColor: "#0b120e",
    filter: (node) => !(node instanceof HTMLElement && node.dataset.noExport !== undefined),
  });
  if (!blob) throw new Error("toBlob vazio");
  const file = new File([blob], filename, { type: "image/png" });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
