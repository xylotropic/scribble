"use strict";
function overlayPosition(workArea, size, position = "top") {
  if (
    position === "hidden" ||
    !workArea ||
    !Array.isArray(size) ||
    size.length !== 2
  )
    return null;
  const { x, y, width, height } = workArea,
    [windowWidth, windowHeight] = size;
  if (
    ![x, y, width, height, windowWidth, windowHeight].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    windowWidth <= 0 ||
    windowHeight <= 0
  )
    return null;
  const top = position === "top" ? y + 15 : y + height - windowHeight - 20;
  return {
    x: Math.round(Math.max(x, x + (width - windowWidth) / 2)),
    y: Math.round(
      Math.max(y, Math.min(top, y + Math.max(0, height - windowHeight))),
    ),
  };
}
function createOverlayPlacement({
  screen,
  overlay,
  getPosition = () => "top",
  intervalMs = 250,
  scheduler = { setInterval, clearInterval },
}) {
  if (
    !screen ||
    !overlay ||
    !Number.isFinite(intervalMs) ||
    intervalMs < 100 ||
    intervalMs > 2000
  )
    throw Error("Invalid overlay placement configuration");
  let timer = null,
    disposed = false;
  function visible() {
    return !disposed && !overlay.isDestroyed() && overlay.isVisible();
  }
  function stop() {
    if (timer !== null) {
      scheduler.clearInterval(timer);
      timer = null;
    }
  }
  function update() {
    if (!visible()) {
      stop();
      return false;
    }
    try {
      const display = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
      );
      const point = overlayPosition(
        display?.workArea,
        overlay.getSize(),
        getPosition(),
      );
      if (!point) return false;
      const [x, y] = overlay.getPosition();
      if (x === point.x && y === point.y) return false;
      overlay.setPosition(point.x, point.y);
      return true;
    } catch {
      return false;
    }
  }
  function start() {
    if (!visible()) return;
    update();
    if (timer === null) {
      timer = scheduler.setInterval(update, intervalMs);
      timer?.unref?.();
    }
  }
  const events = [
    "display-added",
    "display-removed",
    "display-metrics-changed",
  ];
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    for (const name of events) screen.removeListener(name, update);
    overlay.removeListener("show", start);
    overlay.removeListener("hide", stop);
    overlay.removeListener("closed", dispose);
  }
  for (const name of events) screen.on(name, update);
  overlay.on("show", start);
  overlay.on("hide", stop);
  overlay.on("closed", dispose);
  start();
  return { update, dispose };
}
module.exports = { overlayPosition, createOverlayPlacement };
