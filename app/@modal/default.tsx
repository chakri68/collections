// Required in Next 16: every parallel slot needs an explicit default or the
// build fails. Null = the modal renders nothing when its slot is inactive
// (e.g. a hard load of any non-/item URL).
export default function Default() {
  return null;
}
