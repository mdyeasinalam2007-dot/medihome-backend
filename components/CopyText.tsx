"use client";
import { toast } from "./Toast";
export default function CopyText({ text }: { text: string }) {
  return <button type="button" className="btn ghost sm" onClick={() => navigator.clipboard.writeText(text).then(() => toast("Copied"), () => toast("Copy failed", "err"))}>Copy</button>;
}
