/**
 * Haptics — the touch twin of the amber hover/focus states. Short, crisp ticks
 * mapped to semantic events, never decoration. Single module: nothing else
 * calls navigator.vibrate.
 *
 * Android Chromium gets real patterns via navigator.vibrate. iOS Safari has no
 * vibrate, but toggling a native `<input type="checkbox" switch>` (iOS 18+)
 * emits a system tick — so iOS gets one tick whatever the pattern. Anything
 * else degrades to silence; haptics are never the only feedback.
 */
export type HapticPattern = "tick" | "press" | "detent" | "warn" | "error" | "success";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 8,
  press: 15,
  detent: 5,
  warn: [20, 40, 20],
  error: [40, 60, 40],
  success: [10, 50, 20],
};

const STORAGE_KEY = "haptics";
let last = 0;
let iosSwitch: HTMLLabelElement | null = null;
const listeners = new Set<() => void>();

/** Touch devices only — a desktop with a vibrate API stub has nothing to buzz. */
function isTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function iosTick() {
  if (!iosSwitch) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = "__haptic";
    input.tabIndex = -1;
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
    label.append(input);
    document.body.append(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore — the toggle re-renders when the setting flips. */
export function subscribeHaptics(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function haptic(p: HapticPattern = "tick") {
  if (!isTouch() || !hapticsEnabled()) return;
  const now = performance.now();
  if (now - last < 50) return; // one per gesture; slider drags don't become a buzz
  last = now;
  if ("vibrate" in navigator) navigator.vibrate(PATTERNS[p]);
  else iosTick();
}

/**
 * Which pattern a click on `target` earns, if any. An explicit `data-haptic`
 * wins; otherwise the defaults follow visual weight — amber things tick, gray
 * things are silent: `.btn.primary` presses, interactive chips tick, and plain
 * `.btn` gets nothing.
 */
export function hapticFor(target: Element): HapticPattern | null {
  const el = target.closest<HTMLElement>("[data-haptic], .btn.primary, button.chip, a.chip");
  if (!el || el.matches(":disabled, [aria-disabled='true']")) return null;
  if (el.dataset.haptic) return el.dataset.haptic as HapticPattern;
  return el.matches(".btn.primary") ? "press" : "tick";
}
