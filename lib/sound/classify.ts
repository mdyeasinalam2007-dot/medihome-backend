// Decides which interaction sound (if any) an element gets, by looking at the element itself, so no existing
// component needs changing. One action always maps to exactly one sound category.
// Any element can override with data-sound="click|nav|back|close|success|error|none"; everything inside
// data-sound="none" stays silent (the sound controls themselves, for example).
import { CUE_KINDS, type CueKind } from "./cues";

// Things a visitor can activate.
const INTERACTIVE = [
  "a[href]", "button", "summary", "select", '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="option"]',
  '[role="switch"]', '[role="checkbox"]', '[role="radio"]', 'input[type="checkbox"]', 'input[type="radio"]',
  'input[type="submit"]', 'input[type="button"]',
].join(", ");
// Hover chimes are for controls, not for every link inside running text.
const PROSE_LINK = "p a, li > p a, .prose a, small a, label a";
// Explicit in-app "back" controls (the site's back links, or a link/button labelled as going back).
const BACK = '.back-link, [rel="prev"], [data-back]';
const BACK_TEXT = /^(back|go back|←)(\b|$)|\bback to\b|ফিরে/i;
// Closing/dismissing: dialog close buttons, panel close buttons, "cancel"/"not now", or a toggle that is open.
const CLOSE = '[data-modal-close], .rt-side-close, [aria-expanded="true"]';
const CLOSE_TEXT = /^(close|dismiss|cancel|not now|hide|বন্ধ|বাতিল|এখন নয়)\b/i;
// Changing a selection or moving around: tabs, menus, options, toggles, things that open a menu or panel.
const SELECTION = '[role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"], [aria-haspopup], [aria-expanded="false"]';
// Navigation links: the header, navigation bars, the side drawer and the footer.
const NAV_LINK = "header a[href], nav a[href], .drawer a[href], footer a[href], .nav a[href], .nav-scroll a[href]";
// Messages the app already shows. Error banners use role="alert"; confirmations use these classes.
const ERROR_MSG = '[role="alert"], .toast.err';
const SUCCESS_MSG = '.banner.ok, .success, .toast:not(.err)';
const DIALOG = '[role="dialog"], dialog';

const isEl = (t: unknown): t is Element => typeof Element !== "undefined" && t instanceof Element;
const label = (el: Element) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();
function control(target: EventTarget | null): Element | null {
  const el = isEl(target) ? target.closest(INTERACTIVE) : null;
  if (!el || el.closest('[data-sound="none"]')) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true" || el.closest("fieldset:disabled")) return null;
  return el;
}
function override(el: Element): CueKind | null | undefined {
  const v = el.getAttribute("data-sound");
  if (v === "none") return null;
  if (v === "hover") return "click";
  return CUE_KINDS.includes(v as CueKind) ? (v as CueKind) : undefined;
}

/** The control a hover/focus chime belongs to, or null. (The caller plays it once per entry into a control.) */
export function hoverTarget(target: EventTarget | null): Element | null {
  const el = control(target);
  if (!el || override(el) === null || (el.matches(PROSE_LINK) && !isSectionLink(el))) return null;
  return el;
}

// Links in page content (cards, buttons, footer, drawer, the floating Ratchet button) that open one of the
// Doctors..Ratchet AI sections sound exactly like the main menubar: the same hover chime and nav click, and no error
// cue from the page they open. Back links, and filter/clear links within the section page already open, keep their
// own sounds. The main menubar itself is handled separately (interactions.ts) and is not matched here.
const SECTION_PATH = /^\/(doctors|hospitals|beds|blood|tests|ambulance|assistant)(\/|$)/;
const MENUBAR = "header .nav-links a, header .nav-scroll a";
function isSectionLink(el: Element): boolean {
  if (!el.matches("a[href]") || el.closest(MENUBAR) || el.hasAttribute("data-sound")) return false;
  if (el.matches(BACK) || BACK_TEXT.test(label(el))) return false;
  try {
    const u = new URL(el.getAttribute("href") || "", location.href);
    return u.origin === location.origin && SECTION_PATH.test(u.pathname) && u.pathname !== location.pathname;
  } catch { return false; }
}
/** True if this click target is a page-content link into the Doctors..Ratchet AI sections (see above). */
export function sectionLink(target: EventTarget | null): boolean {
  const el = control(target);
  return !!el && isSectionLink(el);
}

/** The sound for activating (click, tap, or Enter/Space on) this element, or null for silence. */
export function pressSound(target: EventTarget | null): CueKind | null {
  const el = control(target);
  if (!el) return null;
  const o = override(el);
  if (o !== undefined) return o;
  if (el.matches("select")) return null; // a select sounds when its value actually changes (see changeSound)
  const text = label(el);
  if (el.matches(BACK) || BACK_TEXT.test(text)) return "back";
  if (el.matches(CLOSE) || CLOSE_TEXT.test(text)) return "close";
  if (el.matches(SELECTION) || isSectionLink(el)) return "nav";
  if (el.matches("a[href]") && !el.matches(".btn")) {
    const href = el.getAttribute("href") || "";
    if (href.startsWith("#")) return "nav"; // jumping within the page
    if (el.matches(NAV_LINK)) return "nav";
  }
  return "click";
}

/** A select or similar control whose value just changed: a selection-change sound. */
export function changeSound(target: EventTarget | null): CueKind | null {
  return isEl(target) && target.matches("select") && control(target) ? "nav" : null;
}

/**
 * For an element that just appeared: "error" if it is (or contains) an error message, "success" if it is a
 * confirmation, otherwise null. Lets the success/error cues follow the app's existing messages.
 */
export function messageSound(node: Node): "success" | "error" | null {
  if (!isEl(node) || node.closest('[data-sound="none"]')) return null;
  if (node.matches(ERROR_MSG) || node.querySelector(ERROR_MSG)) return "error";
  if (node.matches(SUCCESS_MSG) || node.querySelector(SUCCESS_MSG)) return "success";
  return null;
}

/** True if this added/removed node is (or contains) a dialog, drawer or similar panel. */
export function isDialogNode(node: Node): boolean {
  return isEl(node) && !node.closest('[data-sound="none"]') && (node.matches(DIALOG) || !!node.querySelector(DIALOG));
}
