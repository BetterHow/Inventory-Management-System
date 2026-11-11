"use client";
import { useEffect, useRef, useState } from "react";
import { ScanBarcode, X } from "lucide-react";

type Result = { ok: boolean; text: string };

/**
 * A button that opens the phone (or laptop) camera and reads barcodes.
 * The camera stays open so several boxes can be scanned in a row; a box counts once until it leaves the picture.
 * `onCode` says whether the code was recognised and what to show under the picture.
 * Browsers only allow the camera on https pages (and localhost).
 */
export function CameraScan({ onCode, once, label = "相機掃碼", className = "btn-secondary" }: {
  onCode: (code: string) => Result | void;
  once?: boolean; // close after the first recognised code
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`${className} inline-flex items-center gap-1.5`} onClick={() => setOpen(true)}>
        <ScanBarcode className="size-4" />{label}
      </button>
      {open && <Scanner onCode={onCode} once={once} close={() => setOpen(false)} />}
    </>
  );
}

function Scanner({ onCode, once, close }: { onCode: (code: string) => Result | void; once?: boolean; close: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [last, setLast] = useState<Result | null>(null);
  // Always call the newest handler: the parent re-renders after every scan.
  const handler = useRef(onCode);
  handler.current = onCode;
  const shut = useRef(close);
  shut.current = close;

  useEffect(() => {
    let stopped = false;
    let stop: (() => void) | undefined;
    let lastCode = "", lastAt = 0;

    function got(code: string) {
      const now = Date.now();
      // The same box still in view is not a new scan: it counts again only after 2 seconds out of sight.
      const again = code === lastCode && now - lastAt < 2000;
      if (code === lastCode) lastAt = now;
      if (stopped || !code || again) return;
      lastCode = code; lastAt = now;
      const r = handler.current(code) ?? { ok: true, text: code };
      navigator.vibrate?.(r.ok ? 60 : [60, 60, 60]);
      setLast(r);
      if (once && r.ok) shut.current();
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError("這個瀏覽器不能使用相機。請用手機的 Safari 或 Chrome，並確認網址是 https 開頭。");
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        if (stopped) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current!,
          (result) => { if (result) got(result.getText().trim()); },
        );
        stop = () => controls.stop();
        if (stopped) stop();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (stopped) return;
        setError(name === "NotAllowedError" ? "沒有相機權限。請在瀏覽器的網站設定裡允許這個網站使用相機，再試一次。" : name === "NotFoundError" ? "這台裝置找不到相機。" : "相機打不開，請重新整理後再試。");
      }
    })();
    return () => { stopped = true; stop?.(); };
  }, [once]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 p-4" onClick={close}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="font-semibold text-slate-900">把條碼對準框內</span>
          <button type="button" aria-label="關閉" onClick={close} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={video} muted playsInline className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-teal-400/90" />
        </div>
        <div className="min-h-12 px-4 py-2.5 text-sm">
          {error ? <span className="text-rose-600">{error}</span>
            : last ? <span className={last.ok ? "text-emerald-700" : "text-rose-600"}>{last.ok ? "✓ " : "✕ "}{last.text}</span>
            : <span className="text-slate-500">{once ? "掃到就會自動帶入。" : "可以連續掃，掃完按右上角關閉。"}</span>}
        </div>
      </div>
    </div>
  );
}
