import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { errorMessage } from "./utils";

const A4_PX = 794; // A4 width at 96 dpi

function waitForImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r()))),
    ),
  );
}

async function nodeToPdf(node: HTMLElement, filename: string): Promise<File> {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  await document.fonts?.ready;
  const png = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const scale = Math.min(pageW / w, pageH / h);
  pdf.addImage(png, "PNG", (pageW - w * scale) / 2, 0, w * scale, h * scale, undefined, "FAST");
  return new File([pdf.output("blob")], filename, { type: "application/pdf" });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Renders a document component off-screen and turns it into a one-page A4 PDF.
 * Works with Gujarati/Hindi names because the browser does the text rendering.
 */
export function usePdfExport() {
  const [job, setJob] = useState<{ node: ReactNode; resolve: (el: HTMLElement) => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job || !ref.current) return;
    const el = ref.current;
    requestAnimationFrame(() => void waitForImages(el).then(() => job.resolve(el)));
  }, [job]);

  async function exportPdf(node: ReactNode, filename: string, mode: "download" | "share" = "download") {
    setBusy(true);
    // Documents are always printed in light colors.
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    try {
      root.classList.remove("dark");
      const el = await new Promise<HTMLElement>((resolve) => setJob({ node, resolve }));
      const file = await nodeToPdf(el, filename);
      if (mode === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename }).catch((e: Error) => {
          if (e.name !== "AbortError") throw e;
        });
      } else {
        download(file);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (wasDark) root.classList.add("dark");
      setJob(null);
      setBusy(false);
    }
  }

  const holder = job
    ? createPortal(
        <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          <div ref={ref} style={{ width: A4_PX }}>
            {job.node}
          </div>
        </div>,
        document.body,
      )
    : null;

  return { exportPdf, busy, holder };
}
