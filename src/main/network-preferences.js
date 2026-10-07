'use strict';
const dns = require('node:dns');
const net = require('node:net');
function createNetworkPreferences({ dnsModule = dns, netModule = net } = {}) {
  return function applyNetworkPreferences(settings = {}) {
    if (settings.preferIPv4 !== undefined && typeof settings.preferIPv4 !== 'boolean') throw new Error('preferIPv4 must be boolean');
    if (typeof dnsModule.setDefaultResultOrder !== 'function') throw new Error('This runtime cannot change DNS result order');
    const preferIPv4 = settings.preferIPv4 !== false;
    const order = preferIPv4 ? 'ipv4first' : 'verbatim';
    dnsModule.setDefaultResultOrder(order);
    // Family autoselection retains attempts to the other family when the first is unreachable.
    // Never force family:4, disable IPv6, or replace resolver/TLS/proxy configuration.
    const fallbackSupported = typeof netModule.setDefaultAutoSelectFamily === 'function';
    if (fallbackSupported) netModule.setDefaultAutoSelectFamily(true);
    return { preferIPv4, dnsOrder: dnsModule.getDefaultResultOrder?.() || order, autoSelectFamily: fallbackSupported ? (netModule.getDefaultAutoSelectFamily?.() ?? true) : null, scope: 'node-new-connections', chromiumControlled: false };
  };
}
const applyNetworkPreferences = createNetworkPreferences();
module.exports = { applyNetworkPreferences, createNetworkPreferences };
