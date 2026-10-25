import test from 'node:test';
import assert from 'node:assert/strict';
import {createIOSInstallController, detectIOSInstallEnvironment, installCardMarkup} from '../src/ios-install.js';

class Events {
  listeners = new Map();
  addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
  fire(name, detail = {}) { for (const fn of this.listeners.get(name) || []) fn(detail); }
}
class Worker extends Events {
  state = 'activated';
  messages = [];
  postMessage(message) { this.messages.push(message); }
}
function fakeEnvironment(overrides = {}) {
  const active = new Worker(), registration = new Events();
  Object.assign(registration, {active, installing: null, waiting: null});
  const sw = new Events();
  sw.controller = active;
  sw.calls = [];
  sw.register = async (...args) => { sw.calls.push(args); return registration; };
  const media = new Events(); media.matches = false;
  const win = new Events();
  Object.assign(win, {isSecureContext: true, matchMedia: () => media, innerHeight: 844});
  win.visualViewport = new Events(); Object.assign(win.visualViewport, {height: 844, offsetTop: 0});
  const navigator = {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5, serviceWorker: sw, onLine: true};
  const document = {baseURI: 'https://example.test/game/', documentElement: {classList: new Set(), style: {values: {}, setProperty(key, value) { this.values[key] = value; }}}, querySelectorAll: () => []};
  const location = {protocol: 'https:', hostname: 'example.test', href: 'https://example.test/game/'};
  return {window: win, navigator, document, location, enabled: true, active, registration, sw, media, ...overrides};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('only a secure iOS web build registers, never native wrappers or ordinary builds', async () => {
  for (const mutate of [e => { e.enabled = false; }, e => { e.window.desktopBridge = {}; }, e => { e.window.NativeBridge = {}; }, e => { e.location.protocol = 'file:'; }, e => { e.location.protocol = 'http:'; }, e => { e.window.isSecureContext = false; }]) {
    const env = fakeEnvironment(); mutate(env);
    const install = createIOSInstallController(env);
    await install.initialize();
    assert.equal(install.getState().enabled, false);
    assert.equal(install.render(), '');
    assert.equal(env.sw.calls.length, 0);
  }
  const local = fakeEnvironment(); local.location = {protocol: 'http:', hostname: '127.0.0.1', href: 'http://127.0.0.1:5173/'}; local.document.baseURI = local.location.href;
  await createIOSInstallController(local).initialize();
  assert.equal(local.sw.calls.length, 1);
});

test('recognizes desktop-UA iPad, Safari and alternate iPhone browsers without marking a Mac as iOS', () => {
  const base = fakeEnvironment();
  assert.equal(detectIOSInstallEnvironment(base).safari, true);
  base.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15'; base.navigator.platform = 'MacIntel';
  assert.equal(detectIOSInstallEnvironment(base).ios, true);
  base.navigator.maxTouchPoints = 0;
  assert.equal(detectIOSInstallEnvironment(base).ios, false);
  base.navigator.platform = 'iPhone'; base.navigator.userAgent = 'iPhone CriOS/130.0 Mobile Safari/604.1';
  const chrome = detectIOSInstallEnvironment(base);
  assert.equal(chrome.ios, true); assert.equal(chrome.safari, false);
  assert.match(installCardMarkup({...chrome, cache: 'checking'}), /请先用 Safari/);
});

test('initialization is idempotent and scopes the worker to the current application directory', async () => {
  const env = fakeEnvironment(), install = createIOSInstallController(env);
  const onChange = () => {};
  const first = install.initialize({onChange}), second = install.initialize({onChange});
  assert.equal(first, second);
  await first;
  install.bind(); install.bind(); await install.initialize();
  assert.equal(env.sw.calls.length, 1);
  assert.deepEqual(env.sw.calls[0], ['https://example.test/game/sw.js', {scope: 'https://example.test/game/', updateViaCache: 'none'}]);
  for (const name of ['message', 'controllerchange']) assert.equal(env.sw.listeners.get(name).length, 1);
  assert.equal(env.window.listeners.get('pageshow').length, 1);
  assert.equal(env.window.visualViewport.listeners.get('resize').length, 1);
  assert.ok(env.document.documentElement.classList.has('ios-device'));
});

test('standalone detection hides installation steps and changes without replacing the homepage', async () => {
  const env = fakeEnvironment(); env.navigator.standalone = true;
  const guide = {}, status = {}, update = {}, dot = {classList: {toggle() {}}};
  const card = {querySelector: selector => ({'[data-ios-install-guide]': guide, '[data-ios-cache-status]': status, '[data-ios-update-note]': update, '.ios-cache-dot': dot}[selector])};
  env.document.querySelectorAll = () => [card];
  const install = createIOSInstallController(env);
  await install.initialize(); install.bind();
  assert.match(install.render(), /data-ios-install-guide hidden/);
  assert.equal(guide.hidden, true);
  env.navigator.standalone = false; env.media.matches = false; env.media.fire('change');
  assert.equal(guide.hidden, false);
  env.media.matches = true; env.media.fire('change');
  assert.equal(guide.hidden, true);
  assert.match(install.render(), /档案可能分别保存/);
});

test('offline readiness requires the expected worker response and survives a network disconnect', async () => {
  const env = fakeEnvironment(), install = createIOSInstallController(env);
  let changed = 0; const onChange = () => changed++;
  await install.initialize({onChange}); await install.initialize({onChange});
  env.sw.fire('message', {source: new Worker(), data: {type: 'MAO_OFFLINE_STATUS', ready: true}});
  env.sw.fire('message', {source: env.active, data: {type: 'MAO_OFFLINE_STATUS', ready: 'true'}});
  env.sw.fire('message', {source: env.active, data: {type: 'OTHER', ready: true}});
  assert.equal(install.getState().cache, 'checking');
  env.sw.fire('message', {source: env.active, data: {type: 'MAO_OFFLINE_STATUS', ready: true, version: 'build-one'}});
  assert.equal(install.getState().cache, 'ready');
  assert.equal(install.getState().version, 'build-one');
  assert.equal(changed, 1);
  env.navigator.onLine = false; env.window.fire('offline');
  assert.equal(install.getState().cache, 'ready');
  assert.match(install.render(), /离线内容已就绪/);
});

test('a waiting update is announced without activating it or reloading a running life', async () => {
  const env = fakeEnvironment(), waiting = new Worker();
  let reloads = 0; env.location.reload = () => reloads++;
  env.registration.waiting = waiting;
  const install = createIOSInstallController(env); await install.initialize();
  assert.equal(install.getState().updateAvailable, true);
  assert.doesNotMatch(install.render(), /data-ios-update-note hidden/);
  env.sw.fire('controllerchange'); env.window.fire('pageshow'); install.bind();
  assert.equal(reloads, 0);
  assert.deepEqual(waiting.messages, []);
  assert.ok(env.active.messages.every(message => message.type === 'MAO_CACHE_STATUS'));
  assert.match(install.render(), /保存进度后，关闭所有/);
});

test('first install transitions to ready, while a failed install is not called complete', async () => {
  const env = fakeEnvironment(), installing = new Worker(); installing.state = 'installing';
  env.registration.active = null; env.sw.controller = null; env.registration.installing = installing;
  const install = createIOSInstallController(env); await install.initialize();
  installing.state = 'redundant'; installing.fire('statechange');
  assert.equal(install.getState().cache, 'unavailable');
  const fresh = new Worker(); fresh.state = 'installing'; env.registration.installing = fresh; env.registration.fire('updatefound');
  env.registration.active = fresh; env.sw.controller = fresh; fresh.state = 'activated'; fresh.fire('statechange');
  assert.deepEqual(fresh.messages, [{type: 'MAO_CACHE_STATUS'}]);
  env.sw.fire('message', {source: fresh, data: {type: 'MAO_OFFLINE_STATUS', ready: true, version: 'new'}});
  assert.equal(install.getState().cache, 'ready');
  assert.equal(install.getState().updateAvailable, false);
});

test('failed registration can retry on reconnection without duplicating listeners', async () => {
  const env = fakeEnvironment(); env.navigator.onLine = false;
  let attempts = 0;
  env.sw.register = async () => { if (++attempts === 1) throw new Error('network unavailable'); return env.registration; };
  const install = createIOSInstallController(env); await install.initialize();
  assert.equal(install.getState().cache, 'offline');
  env.navigator.onLine = true; env.window.fire('online'); await tick();
  assert.equal(attempts, 2);
  assert.equal(install.getState().cache, 'checking');
  assert.equal(env.sw.listeners.get('message').length, 1);
  env.sw.fire('message', {source: env.active, data: {type: 'MAO_OFFLINE_STATUS', ready: true}});
  assert.equal(install.getState().cache, 'ready');
});

test('iPhone visual viewport updates dialog bounds when the keyboard opens', async () => {
  const env = fakeEnvironment(), install = createIOSInstallController(env); await install.initialize();
  assert.equal(env.document.documentElement.style.values['--ios-visible-height'], '844px');
  Object.assign(env.window.visualViewport, {height: 421.4, offsetTop: 80.7});
  env.window.visualViewport.fire('resize');
  assert.equal(env.document.documentElement.style.values['--ios-visible-height'], '421px');
  assert.equal(env.document.documentElement.style.values['--ios-visible-top'], '81px');
});

test('network events during an in-flight registration do not start another registration', async () => {
  const env = fakeEnvironment(); let finish, calls = 0;
  env.sw.register = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const install = createIOSInstallController(env), pending = install.initialize();
  env.window.fire('online'); env.window.fire('online');
  assert.equal(calls, 1);
  finish(env.registration); await pending;
  assert.equal(env.registration.listeners.get('updatefound').length, 1);
});
