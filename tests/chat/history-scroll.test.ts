import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHistoryScrollGate } from '../../src/features/chat/utils/history-scroll-gate';

test('only scrolling toward older history requests a page, once per gesture', () => {
  const gate = createHistoryScrollGate();

  assert.equal(gate.shouldLoad(100, 0), false); // Initial layout.
  gate.beginDrag(100);
  assert.equal(gate.shouldLoad(200, 400), false); // Far from older edge.
  assert.equal(gate.shouldLoad(300, 100), true);
  assert.equal(gate.shouldLoad(400, 0), false); // Repeated edge event.
  gate.endScroll();
  gate.beginMomentum();
  assert.equal(gate.shouldLoad(600, 0), false); // Same gesture after page/layout change.
  gate.endScroll();
  assert.equal(gate.shouldLoad(700, 0), false);
  gate.beginDrag(700);
  assert.equal(gate.shouldLoad(680, 20), false); // Toward latest messages.
  assert.equal(gate.shouldLoad(720, 0), true); // Next intentional request.
});

test('a fling can reach the older edge after the finger leaves the screen', () => {
  const gate = createHistoryScrollGate();

  gate.beginDrag(0);
  assert.equal(gate.shouldLoad(100, 500), false);
  gate.endScroll();
  gate.beginMomentum();
  assert.equal(gate.shouldLoad(500, 100), true);
  gate.endScroll();
  assert.equal(gate.shouldLoad(600, 0), false);
});
