/**
 * Loader for Spotify's IFrame API (https://open.spotify.com/embed/iframe-api/v1).
 *
 * The script announces itself by calling `window.onSpotifyIframeApiReady` exactly
 * once, which is a race if anything else loads the script: mount after it has
 * already fired and the callback never comes. So this module owns the script tag
 * — the hook is installed first, the tag second, and the resulting promise is
 * cached, so every player on the page shares one load and one API object.
 *
 * Client-only. Nothing here runs during the server render.
 */

export interface SpotifyEmbedController {
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  loadUri(uri: string): void;
  destroy(): void;
  addListener(event: "ready", cb: () => void): void;
  addListener(event: "playback_update", cb: (e: { data: SpotifyPlaybackState }) => void): void;
  addListener(event: "autoplay_failed", cb: () => void): void;
}

export interface SpotifyPlaybackState {
  isPaused: boolean;
  isBuffering: boolean;
  /** Milliseconds. */
  duration: number;
  position: number;
}

export interface SpotifyCreateOptions {
  /** `spotify:track:ID`. Ignored when `url` is given. */
  uri?: string;
  /** Full Spotify URL. Takes precedence over `uri` and keeps its query string. */
  url?: string;
  width?: string | number;
  height?: string | number;
}

export interface SpotifyIFrameApi {
  createController(
    element: HTMLElement,
    options: SpotifyCreateOptions,
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
  }
}

const SCRIPT_SRC = "https://open.spotify.com/embed/iframe-api/v1";
/** Give up rather than leave a player stuck on its poster forever. */
const LOAD_TIMEOUT_MS = 8000;

let pending: Promise<SpotifyIFrameApi> | null = null;

export function loadSpotifyIframeApi(): Promise<SpotifyIFrameApi> {
  if (pending) return pending;

  pending = new Promise<SpotifyIFrameApi>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("spotify iframe api timed out")), LOAD_TIMEOUT_MS);

    // Chain rather than clobber — if something else is waiting on this hook,
    // it still gets its call.
    const previous = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timer);
      previous?.(api);
      resolve(api);
    };

    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error("spotify iframe api failed to load"));
      };
      document.head.appendChild(script);
    }
  });

  // A failed load shouldn't poison every later attempt — drop the cache so a
  // second player (or a retry) can try again.
  pending.catch(() => {
    pending = null;
  });

  return pending;
}
