"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  { EventEmitter } = require("node:events");
const {
  overlayPosition,
  createOverlayPlacement,
} = require("../src/main/overlay-placement");
test("pure work-area geometry preserves top/bottom margins on scaled and negative-origin displays", () => {
  assert.deepEqual(
    overlayPosition(
      { x: 0, y: 24, width: 1920, height: 1056 },
      [360, 90],
      "top",
    ),
    { x: 780, y: 39 },
  );
  assert.deepEqual(
    overlayPosition(
      { x: -1440, y: 24, width: 1440, height: 876 },
      [360, 90],
      "bottom",
    ),
    { x: -900, y: 790 },
  );
  assert.deepEqual(
    overlayPosition({ x: 5, y: 6, width: 200, height: 60 }, [360, 90], "top"),
    { x: 5, y: 6 },
  );
  assert.equal(
    overlayPosition(
      { x: 0, y: 0, width: 1920, height: 1080 },
      [360, 90],
      "hidden",
    ),
    null,
  );
  assert.equal(
    overlayPosition({ x: 0, y: 0, width: NaN, height: 1080 }, [360, 90]),
    null,
  );
});
function fixture() {
  const screen = new EventEmitter(),
    overlay = new EventEmitter(),
    tasks = new Map(),
    positions = [];
  let shown = false,
    destroyed = false,
    point = { x: 0, y: 0 },
    position = [0, 0],
    setting = "top",
    next = 0;
  screen.getCursorScreenPoint = () => point;
  screen.getDisplayNearestPoint = (cursor) => ({
    workArea:
      cursor.x < 0
        ? { x: -1000, y: 0, width: 1000, height: 800 }
        : { x: 0, y: 24, width: 1200, height: 776 },
  });
  overlay.isDestroyed = () => destroyed;
  overlay.isVisible = () => shown;
  overlay.getSize = () => [360, 90];
  overlay.getPosition = () => position;
  overlay.setPosition = (x, y) => {
    position = [x, y];
    positions.push(position);
  };
  const scheduler = {
    setInterval(fn, ms) {
      assert.equal(ms, 250);
      const id = ++next;
      tasks.set(id, fn);
      return id;
    },
    clearInterval(id) {
      tasks.delete(id);
    },
  };
  const controller = createOverlayPlacement({
    screen,
    overlay,
    getPosition: () => setting,
    scheduler,
  });
  return {
    screen,
    overlay,
    tasks,
    positions,
    controller,
    tick() {
      for (const fn of tasks.values()) fn();
    },
    show() {
      shown = true;
      overlay.emit("show");
    },
    hide() {
      shown = false;
      overlay.emit("hide");
    },
    cursor(x) {
      point = { x, y: 0 };
    },
    setting(value) {
      setting = value;
    },
    destroy() {
      destroyed = true;
      overlay.emit("closed");
    },
  };
}
test("cursor following polls only visible window and moves only when placement changes", () => {
  const f = fixture();
  assert.equal(f.tasks.size, 0);
  f.tick();
  assert.equal(f.positions.length, 0);
  f.show();
  assert.equal(f.tasks.size, 1);
  assert.deepEqual(f.positions, [[420, 39]]);
  f.tick();
  assert.equal(f.positions.length, 1);
  f.cursor(-1);
  f.tick();
  assert.deepEqual(f.positions.at(-1), [-680, 15]);
  f.setting("bottom");
  f.controller.update();
  assert.deepEqual(f.positions.at(-1), [-680, 690]);
  f.hide();
  assert.equal(f.tasks.size, 0);
  f.cursor(1);
  f.screen.emit("display-metrics-changed");
  assert.equal(f.positions.length, 3);
  f.show();
  assert.equal(f.tasks.size, 1);
  assert.deepEqual(f.positions.at(-1), [420, 690]);
  f.controller.dispose();
});
test("display metrics changes reposition immediately and destruction/quit disposal remove timer and listeners", () => {
  const f = fixture();
  f.show();
  f.screen.getDisplayNearestPoint = () => ({
    workArea: { x: 0, y: 0, width: 800, height: 600 },
  });
  f.screen.emit("display-metrics-changed");
  assert.deepEqual(f.positions.at(-1), [220, 15]);
  assert.equal(f.screen.listenerCount("display-added"), 1);
  f.destroy();
  assert.equal(f.tasks.size, 0);
  assert.equal(f.screen.listenerCount("display-added"), 0);
  assert.equal(f.overlay.listenerCount("show"), 0);
  f.controller.dispose();
  f.screen.emit("display-removed");
  assert.equal(f.positions.length, 2);
  const q = fixture();
  q.show();
  q.controller.dispose();
  assert.equal(q.tasks.size, 0);
  assert.equal(q.screen.listenerCount("display-metrics-changed"), 0);
});
