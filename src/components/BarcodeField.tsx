"use client";
import { useRef } from "react";
import { CameraScan } from "./CameraScan";

/** The item's barcode: type it, use a scanner gun, or read it off the box with the camera. */
export function BarcodeField({ defaultValue }: { defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <input ref={ref} name="barcode" className="input min-w-0 flex-1" defaultValue={defaultValue} />
      <CameraScan once label="" className="btn-secondary px-2.5" onCode={(code) => { if (ref.current) ref.current.value = code; }} />
    </div>
  );
}
