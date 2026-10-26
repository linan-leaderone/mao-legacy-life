// This module never changes a save, activates a waiting worker or reloads a page.
const BUILD_ENABLED = typeof __IOS_PWA__ !== 'undefined' && __IOS_PWA__ === true;

export function detectIOSInstallEnvironment({window: win = {}, navigator: nav = {}, location: loc = {}, enabled = false} = {}) {
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone = nav.standalone === true || win.matchMedia?.('(display-mode: standalone)')?.matches === true;
  const safari = ios && /Safari\//.test(nav.userAgent || '') && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|FBAN|FBAV|Instagram|MicroMessenger|GSA\//.test(nav.userAgent || '');
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(loc.hostname);
  const secure = (loc.protocol === 'https:' || (loc.protocol === 'http:' && loopback)) && win.isSecureContext !== false;
  const native = Boolean(win.desktopBridge || win.NativeBridge);
  return {enabled: Boolean(enabled && secure && !native), ios, safari, standalone};
}

function cacheDescription(state) {
  if (state.cache === 'ready') return '离线内容已就绪。地方地图与旗帜首次查看需联网，已查看的内容会保存；AI 叙述需要联网。';
  if (state.cache === 'offline') return '暂时没有网络，离线内容尚未确认完整。请联网后再次打开。';
  if (state.cache === 'unavailable') return '离线内容尚未保存完整。请保持联网，稍后重新打开。';
  return '正在保存离线内容，首次下载请保持页面打开。';
}

export function installCardMarkup(state) {
  if (!state.enabled) return '';
  const guide = state.ios
    ? `${state.safari ? '' : '<p>请先用 Safari 打开此页面。</p>'}<p>轻点 Safari 的分享按钮，选择「添加到主屏幕」，再轻点「添加」。若出现「作为网页 App 打开」，请保持开启。</p><p>添加后从主屏幕图标打开，再设置连接和建立档案。浏览器与主屏幕中的档案可能分别保存；已有档案可先导出，再从主屏幕导入。</p>`
    : '<p>在 iPhone 的 Safari 中打开此页面，轻点分享按钮 → 添加到主屏幕 → 添加。随后从主屏幕图标打开，再设置连接和建立档案。</p>';
  return `<section class="ios-install-card" data-ios-install-card aria-label="iPhone 安装与离线状态">
    <div data-ios-install-guide${state.standalone ? ' hidden' : ''}><h2>装到 iPhone 主屏幕</h2>${guide}</div>
    <div class="ios-cache-state" role="status" aria-live="polite" aria-atomic="true"><span class="ios-cache-dot${state.cache === 'ready' ? ' ready' : ''}" aria-hidden="true"></span><p data-ios-cache-status>${cacheDescription(state)}</p></div>
    <p class="ios-update-note" data-ios-update-note${state.updateAvailable ? '' : ' hidden'}>新版已准备好。保存进度后，关闭所有本游戏窗口，再重新打开。</p>
  </section>`;
}

export function createIOSInstallController(environment = {}) {
  const win = environment.window || globalThis.window || {};
  const nav = environment.navigator || win.navigator || globalThis.navigator || {};
  const doc = environment.document || win.document || globalThis.document;
  const loc = environment.location || win.location || {};
  const enabled = environment.enabled ?? BUILD_ENABLED;
  const detected = detectIOSInstallEnvironment({window: win, navigator: nav, location: loc, enabled});
  let state = {...detected, cache: nav.onLine === false ? 'offline' : 'checking', updateAvailable: false, version: ''};
  let started = false, registering = false, registration, registrationPromise, cacheTimer;
  const callbacks = new Set(), observedWorkers = new WeakSet();
  const getState = () => ({...state});

  function refreshCards(root = doc) {
    if (!root?.querySelectorAll) return;
    for (const card of root.querySelectorAll('[data-ios-install-card]')) {
      card.hidden = !state.enabled;
      const guide = card.querySelector('[data-ios-install-guide]');
      if (guide) guide.hidden = state.standalone;
      const status = card.querySelector('[data-ios-cache-status]');
      if (status) status.textContent = cacheDescription(state);
      card.querySelector('.ios-cache-dot')?.classList.toggle('ready', state.cache === 'ready');
      const update = card.querySelector('[data-ios-update-note]');
      if (update) update.hidden = !state.updateAvailable;
    }
  }

  function update(next) {
    if (Object.entries(next).every(([key, value]) => state[key] === value)) return;
    state = {...state, ...next};
    if (state.cache === 'ready' && cacheTimer) { clearTimeout(cacheTimer); cacheTimer = undefined; }
    refreshCards();
    for (const callback of callbacks) { try { callback(getState()); } catch { /* A view callback must not interrupt caching. */ } }
  }

  function requestStatus() {
    const worker = registration?.active || nav.serviceWorker?.controller;
    if (worker) { try { worker.postMessage({type: 'MAO_CACHE_STATUS'}); } catch { /* A retiring worker can disappear between events. */ } }
  }

  function watchWorker(worker) {
    if (!worker || observedWorkers.has(worker)) return;
    observedWorkers.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') update({updateAvailable: Boolean(registration?.waiting)});
      if (worker.state === 'activated') requestStatus();
      if (worker.state === 'redundant' && !registration?.active && state.cache !== 'ready') update({cache: nav.onLine === false ? 'offline' : 'unavailable'});
    });
  }

  function syncViewport() {
    if (!state.ios) return;
    const viewport = win.visualViewport;
    const height = viewport?.height || win.innerHeight;
    if (Number.isFinite(height) && height > 0) doc?.documentElement?.style.setProperty('--ios-visible-height', `${Math.round(height)}px`);
    const offset = viewport?.offsetTop || 0;
    doc?.documentElement?.style.setProperty('--ios-visible-top', `${Math.max(0, Math.round(offset))}px`);
  }

  function register() {
    if (registrationPromise) return registrationPromise;
    registering = true;
    registrationPromise = (async () => {
      try {
        const base = new URL('./', doc?.baseURI || loc.href);
        registration = await nav.serviceWorker.register(new URL('sw.js', base).href, {scope: base.href, updateViaCache: 'none'});
        update({updateAvailable: Boolean(registration.waiting)});
        watchWorker(registration.installing);
        registration.addEventListener('updatefound', () => watchWorker(registration.installing));
        requestStatus();
      } catch {
        update({cache: nav.onLine === false ? 'offline' : 'unavailable'});
      } finally {
        registering = false;
      }
      return getState();
    })();
    return registrationPromise;
  }

  function initialize({onChange} = {}) {
    if (typeof onChange === 'function') callbacks.add(onChange);
    if (started) return registrationPromise || Promise.resolve(getState());
    started = true;
    if (!state.enabled) return Promise.resolve(getState());
    doc?.documentElement?.classList.add('ios-web-app');
    if (state.ios) {
      doc?.documentElement?.classList.add('ios-device');
      syncViewport();
      win.visualViewport?.addEventListener('resize', syncViewport);
      win.visualViewport?.addEventListener('scroll', syncViewport);
      win.addEventListener?.('resize', syncViewport);
    }
    const displayMode = win.matchMedia?.('(display-mode: standalone)');
    const modeChange = () => update({standalone: nav.standalone === true || displayMode?.matches === true});
    if (displayMode?.addEventListener) displayMode.addEventListener('change', modeChange);
    else displayMode?.addListener?.(modeChange);
    win.addEventListener?.('pageshow', () => { modeChange(); syncViewport(); requestStatus(); });
    win.addEventListener?.('offline', () => { if (state.cache !== 'ready') update({cache: 'offline'}); });
    win.addEventListener?.('online', () => {
      if (!nav.serviceWorker?.register) return;
      if (state.cache !== 'ready') update({cache: 'checking'});
      if (!registration && !registering) { registrationPromise = undefined; register(); }
      else requestStatus();
    });
    if (!nav.serviceWorker?.register) { update({cache: 'unavailable'}); return Promise.resolve(getState()); }
    nav.serviceWorker.addEventListener('message', event => {
      if (!event.source || ![registration?.active, nav.serviceWorker.controller].includes(event.source)) return;
      if (event.data?.type !== 'MAO_OFFLINE_STATUS' || typeof event.data.ready !== 'boolean') return;
      update({cache: event.data.ready ? 'ready' : nav.onLine === false ? 'offline' : 'unavailable', version: typeof event.data.version === 'string' ? event.data.version.slice(0, 100) : ''});
    });
    nav.serviceWorker.addEventListener('controllerchange', requestStatus);
    cacheTimer = setTimeout(() => { if (state.cache !== 'ready') update({cache: nav.onLine === false ? 'offline' : 'unavailable'}); }, 120000);
    cacheTimer.unref?.();
    return register();
  }

  // Re-rendering the homepage only updates its nodes; global listeners stay singular.
  function bind(root = doc) { refreshCards(root); if (started && state.enabled) requestStatus(); }
  return {initialize, render: () => installCardMarkup(state), bind, getState};
}

let controller;
function defaultController() { return controller ||= createIOSInstallController(); }
export function initializeIOSInstall(options) { return defaultController().initialize(options); }
export function renderInstallCard() { return defaultController().render(); }
export function bindInstallCard(root) { defaultController().bind(root); }
