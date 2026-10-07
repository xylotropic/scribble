'use strict';
// Serialize native updates, retaining the newest desired state across async replies.
function createNativeIndicator({ request, showElectron }) {
  let desired = null, revision = 0, running = false, nativeVisible = false, disposed = false;
  async function drain() {
    if (running || disposed) return;
    running = true;
    try {
      while (!disposed && desired) {
        const current = desired, version = revision;
        if (current.useNative) {
          try {
            const result = await request(nativeVisible ? 'indicatorUpdate' : 'indicatorShow', current.payload);
            nativeVisible = result?.visible === true;
            if (version === revision && !disposed) showElectron(current.visible && !nativeVisible);
          } catch {
            nativeVisible = false;
            await request('indicatorHide').catch(() => {});
            if (version === revision && !disposed) showElectron(current.visible);
          }
        } else if (nativeVisible) {
          await request('indicatorHide').catch(() => {});
          nativeVisible = false;
        }
        if (version === revision) { desired = null; break; }
      }
    } finally {
      running = false;
      if (disposed && nativeVisible) {
        await request('indicatorHide').catch(() => {});
        nativeVisible = false;
      }
    }
  }
  return {
    update(payload, visible) {
      if (disposed) return;
      desired = { payload, visible, useNative: visible && payload.style === 'notch' && payload.position !== 'hidden' };
      revision++;
      showElectron(visible && !desired.useNative);
      void drain();
    },
    dispose() { disposed = true; desired = null; if (nativeVisible || running) void request('indicatorHide').catch(() => {}); },
  };
}
module.exports = { createNativeIndicator };
