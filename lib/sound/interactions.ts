// Wires MediHome's interaction sounds to the page by event delegation: one set of listeners on the document, so no
// existing component needs to change. Each user action produces at most one sound:
//   - hover: when a mouse pointer enters a control (once per entry; never on touch, never while it stays there)
//   - keyboard focus: the same soft chime when Tab / arrow keys move focus to a control
//   - activation (click, tap, Enter/Space): click / nav / back / close, by what the control is (see classify.ts)
//   - a select's value changing: nav
//   - a dialog or drawer opening (nav) or closing (close), when no other sound already covered that action,
//     e.g. closing with Esc or by clicking the backdrop
//   - the app's confirmation and error messages appearing right after the visitor did something: success / error
import type { CueKind } from "./cues";
import { changeSound, hoverTarget, isDialogNode, messageSound, pressSound, sectionLink } from "./classify";

const ACTION_COVERS_MS = 400; // a dialog opening/closing this soon after a sound belongs to the same action
const HOVER_QUIET_MS = 350; //   after an action or page change, content moving under a still pointer doesn't chime
const SAME_TARGET_MS = 400; //   re-entering the same control this quickly (edge jitter) doesn't chime again
const MESSAGE_WINDOW_MS = 10_000; // success/error only for messages that follow something the visitor did

export type InteractionOptions = {
  /** Plays a cue (the caller applies mute, volume and speech-priority rules). */
  cue: (kind: CueKind) => void;
  /** Elements whose own interactions should stay silent (e.g. the sound controls). */
  ignore?: (el: Node) => boolean;
};

/** Attaches the listeners; returns a function that removes them all. */
export function attachInteractionSounds({ cue, ignore = () => false }: InteractionOptions): () => void {
  const doc = document;
  const canHover = window.matchMedia?.("(hover: hover)").matches ?? false;
  let lastSound = 0, lastAct = 0, quietUntil = 0, lastKeyNav = 0;
  let lastHover: Element | null = null; //        the control the pointer is currently inside
  let lastChimed: Element | null = null, lastChimeAt = 0, lastHref = location.href;
  const play = (k: CueKind) => { lastSound = Date.now(); cue(k); };
  const acted = () => { const n = Date.now(); lastAct = n; quietUntil = n + HOVER_QUIET_MS; };

  const onOver = (e: PointerEvent) => {
    if (!canHover || e.pointerType !== "mouse") return; // no hover sounds on touch or pen
    const now = Date.now();
    if (location.href !== lastHref) { lastHref = location.href; quietUntil = now + HOVER_QUIET_MS; } // new page under the pointer
    const el = hoverTarget(e.target);
    if (el === lastHover) return; // still inside the same control
    lastHover = el;
    if (!el || ignore(el) || now < quietUntil) return;
    if (el === lastChimed && now - lastChimeAt < SAME_TARGET_MS) return;
    lastChimed = el; lastChimeAt = now;
    play("hover");
  };
  const onOut = (e: PointerEvent) => { if (!e.relatedTarget) lastHover = null; }; // pointer left the window

  // keyboard focus feedback: only when focus moved because of Tab / arrow keys (not clicks, not scripts)
  const onKey = (e: KeyboardEvent) => {
    acted();
    if (e.key === "Tab" || e.key.startsWith("Arrow")) lastKeyNav = Date.now();
  };
  const onFocus = (e: FocusEvent) => {
    if (Date.now() - lastKeyNav > 600) return;
    const el = hoverTarget(e.target);
    if (!el || ignore(el)) return;
    try { if (!el.matches(":focus-visible")) return; } catch { /* older browsers */ }
    play("hover");
  };

  const onClick = (e: MouseEvent) => {
    acted();
    // Main menubar links make only their own click sound (like Home): an error box on the page they open isn't a
    // response to this click, so it must not add the error cue.
    if ((e.target as Element | null)?.closest?.("header .nav-links a, header .nav-scroll a")) lastAct = 0;
    if (sectionLink(e.target)) lastAct = 0; // page-content links into those sections behave the same (classify.ts)
    if (ignore(e.target as Node)) return;
    const k = pressSound(e.target);
    if (k) play(k);
  };
  const onChange = (e: Event) => {
    if (ignore(e.target as Node)) return;
    const k = changeSound(e.target);
    if (k) { acted(); play(k); }
  };
  const onSubmit = () => acted();

  const obs = typeof MutationObserver === "undefined" ? null : new MutationObserver((list) => {
    const now = Date.now();
    let msg: CueKind | null = null, opened = false, closed = false;
    for (const m of list) {
      for (const n of Array.from(m.addedNodes)) { msg = msg || messageSound(n); if (isDialogNode(n)) opened = true; }
      for (const n of Array.from(m.removedNodes)) if (isDialogNode(n)) closed = true;
    }
    if (msg && now - lastAct < MESSAGE_WINDOW_MS) { play(msg); return; }
    if (now - lastSound < ACTION_COVERS_MS) return; // the click that caused this already made its sound
    if (closed) play("close"); else if (opened) play("nav");
  });
  obs?.observe(doc.body, { childList: true, subtree: true });

  const opts = { capture: true, passive: true } as const;
  doc.addEventListener("pointerover", onOver, opts);
  doc.addEventListener("pointerout", onOut, opts);
  doc.addEventListener("keydown", onKey, opts);
  doc.addEventListener("focusin", onFocus, opts);
  doc.addEventListener("click", onClick, opts);
  doc.addEventListener("change", onChange, opts);
  doc.addEventListener("submit", onSubmit, opts);
  return () => {
    obs?.disconnect();
    doc.removeEventListener("pointerover", onOver, opts);
    doc.removeEventListener("pointerout", onOut, opts);
    doc.removeEventListener("keydown", onKey, opts);
    doc.removeEventListener("focusin", onFocus, opts);
    doc.removeEventListener("click", onClick, opts);
    doc.removeEventListener("change", onChange, opts);
    doc.removeEventListener("submit", onSubmit, opts);
  };
}
