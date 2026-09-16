export function createHistoryScrollGate() {
  let active = false;
  let requested = false;
  let previousOffset = 0;

  return {
    beginDrag(offset: number) {
      active = true;
      requested = false;
      previousOffset = offset;
    },
    beginMomentum() {
      active = true;
    },
    endScroll() {
      active = false;
    },
    shouldLoad(offset: number, distanceToOlderEnd: number) {
      const movingOlder = offset > previousOffset;

      previousOffset = offset;
      if (!active || requested || !movingOlder || distanceToOlderEnd > 160) {
        return false;
      }

      // One page per gesture, including its momentum; layout changes cannot chain page requests.
      requested = true;

      return true;
    },
  };
}
