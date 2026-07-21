// Closes the modal on a client-side navigation to any route the intercept
// doesn't match. Without this, the slot's last-rendered modal stays visible
// after soft-navigating away (Next keeps unmatched slot state on soft nav).
export default function CatchAll() {
  return null;
}
