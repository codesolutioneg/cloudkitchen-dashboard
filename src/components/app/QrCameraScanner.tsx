import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function QrCameraScanner({
  onScan,
  className,
}: {
  onScan: (value: string) => void;
  className?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `ck-qr-reader-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner.stop().catch(() => undefined).finally(() => {
          scanner.clear();
        });
      }
    };
  }, []);

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setActive(false);
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* already stopped */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  }

  async function startCamera() {
    if (starting || active) return;
    handledRef.current = false;
    setStarting(true);
    try {
      // Secure context (HTTPS / localhost) is required for camera on mobile browsers.
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error(t("Camera needs HTTPS. Open the dashboard with https."));
      }

      await stopCamera();
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewW, viewH) => {
            const side = Math.floor(Math.min(viewW, viewH) * 0.72);
            return { width: side, height: side };
          },
          aspectRatio: 1,
        },
        (decoded) => {
          if (handledRef.current) return;
          const value = decoded.trim();
          if (value.length < 8) return;
          handledRef.current = true;
          void (async () => {
            await stopCamera();
            onScan(value);
          })();
        },
        () => {
          /* ignore frame decode misses */
        },
      );
      setActive(true);
    } catch (e) {
      await stopCamera();
      const msg = (e as Error).message || t("Could not open camera");
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        id={elementId}
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-black",
          active ? "min-h-[280px]" : "hidden",
        )}
      />
      {!active ? (
        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={starting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-bold text-primary-foreground shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {starting ? t("Opening camera…") : t("Open camera to scan QR")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void stopCamera()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold"
        >
          <CameraOff className="h-4 w-4" />
          {t("Close camera")}
        </button>
      )}
    </div>
  );
}
