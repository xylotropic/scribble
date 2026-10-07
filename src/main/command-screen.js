"use strict";
function aborted() { return new DOMException("Command screen capture canceled", "AbortError"); }
function images(value, native = false) {
  if (!Array.isArray(value) || value.length > 5) throw Error("A command can include at most five images");
  return value.map(image => {
    if (!image || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.mimeType) || typeof image.data !== "string" || !image.data || image.data.length > 4 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) throw Error("Invalid command image");
    const bytes = Buffer.from(image.data, "base64");
    if (bytes.toString("base64") !== image.data || bytes.length > (native ? 3 : 4) * 1024 * 1024) throw Error("Invalid or oversized command image");
    if (native && (image.mimeType !== "image/jpeg" || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width > 1536 || image.height > 1536)) throw Error("Invalid native screen image dimensions");
    return {mimeType:image.mimeType,data:image.data};
  });
}
function mergeImages(...groups) { return images(groups.flatMap(group => group || [])); }
class CommandScreenSession {
  constructor(request, {timeoutMs = 22000} = {}) { this.request = request; this.timeoutMs = timeoutMs; this.owner = null; this.closing = false; this.pending = new Set(); }
  bounded(promise) {
    return new Promise((resolve, reject) => {
      let timer;
      const settle = (callback,value) => {clearTimeout(timer);this.pending.delete(cancel);callback(value);};
      const cancel = () => settle(reject,aborted());
      this.pending.add(cancel);
      timer = setTimeout(() => settle(reject,Error("Command screen capture timed out")), this.timeoutMs);
      Promise.resolve(promise).then(value => settle(resolve,value), error => settle(reject,error));
    });
  }
  check(session) { if (this.closing || this.owner !== session || session.cancelled) throw aborted(); }
  async start(token, dragRegions) {
    if (this.owner || this.closing) throw Error("Finish the previous screen capture first");
    const session = {token,dragRegions,cancelled:false}; this.owner = session;
    try {
      const result = await this.bounded(this.request("commandScreenStart", {token,dragRegions}));
      this.check(session);
      if (result?.token !== token || result.started !== true || result.status !== "ready" || result.dragRegions !== dragRegions) throw Error("Screen capture did not become ready");
    } catch (error) { await this.cancel(token).catch(() => {}); throw error; }
  }
  async finish(token) {
    const session = this.owner;
    if (!session || session.token !== token) throw aborted();
    this.check(session);
    try {
      const result = await this.bounded(this.request("commandScreenFinish", {token}));
      this.check(session);
      if (result?.token !== token || !["regions","display"].includes(result.source)) throw Error("Invalid screen capture result");
      if (session.dragRegions && (result.source !== "regions" || !result.images?.length || result.regionCount !== result.images.length)) throw Error("Select at least one screen region, or turn off region capture.");
      if (!session.dragRegions && (result.source !== "display" || result.regionCount !== 0 || result.images?.length !== 1)) throw Error("Invalid automatic screen capture result");
      const output = images(result.images, true);
      if (!output.length) throw Error("Screen capture returned no images");
      this.owner = null;
      return output;
    } catch (error) { await this.cancel(token).catch(() => {}); throw error; }
  }
  async cancel(token = this.owner?.token) {
    const session = this.owner;
    if (!session || session.token !== token) return;
    session.cancelled = true;
    if (this.closing) return;
    if (!session.cancelPromise) session.cancelPromise = this.bounded(this.request("commandScreenCancel", {token})).then(result => {
      if (result?.token !== token || typeof result.cancelled !== "boolean") throw Error("Screen capture cancellation was not confirmed");
      if (this.owner === session) this.owner = null;
    }).catch(error => {session.cancelPromise = null;throw error;});
    return session.cancelPromise;
  }
  metadata(event, value) {
    if (!this.owner || this.owner.cancelled || this.closing || value?.token !== this.owner.token) return null;
    if (event === "command-region-count" && Number.isInteger(value.count) && value.count >= 0 && value.count <= 5 && value.maxRegions === 5) return {token:value.token,count:value.count,maxRegions:5};
    if (event === "command-screen-status" && ["ready","selecting","capturing","cancelled","error"].includes(value.status)) {
      if (value.error !== undefined && (typeof value.error !== "string" || value.error.length > 1000 || /[\x00-\x1f\x7f]/.test(value.error))) return null;
      return {token:value.token,status:value.status,...(value.error ? {error:value.error} : {})};
    }
    return null;
  }
  bridgeClosing() { this.closing = true; if (this.owner) this.owner.cancelled = true; for (const cancel of [...this.pending]) cancel(); }
  bridgeExited() { this.owner = null; }
}
module.exports = {CommandScreenSession, mergeImages};
