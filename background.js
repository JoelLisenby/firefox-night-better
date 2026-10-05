const DEFAULTS = {
  proxyEnabled: false,
  lastProxyType: "",
  radiusScale: 0,
  hideShare: true,
};

const PRIVATE_WINDOWS_ERROR =
  "Allow Night Better in Private Windows (about:addons → ... next to Night Better → Manage → Run in Private Windows → Allow) so the proxy switch can update Firefox Settings. Temporary add-ons need this granted again after each load.";

const PROXY_KEYS = [
  "autoConfigUrl",
  "autoLogin",
  "ftp",
  "http",
  "httpProxyAll",
  "passthrough",
  "proxyDNS",
  "proxyType",
  "socks",
  "socksVersion",
  "ssl",
];

let applyingProxy = 0;

const RADIUS_MIN = 0;
const RADIUS_MAX = 100;

const NOVA_RADIUS = {
  xsmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
};

function clampRadiusScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return RADIUS_MIN;
  }
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(n)));
}

function radiusFromStorage(stored) {
  if (typeof stored.radiusScale === "number") {
    return clampRadiusScale(stored.radiusScale);
  }
  if (stored.squareCorners === false) {
    return RADIUS_MAX;
  }
  return RADIUS_MIN;
}

function novaPx(token, scale) {
  return Math.round((NOVA_RADIUS[token] * scale) / RADIUS_MAX);
}

const CORNERS_START = "/* firefox-better:corners-start */";
const CORNERS_END = "/* firefox-better:corners-end */";

function radiusChromeCss(scale) {
  if (scale >= RADIUS_MAX) {
    return "/* Nova rounding. No Night Better radius override. */";
  }

  const xs = novaPx("xsmall", scale);
  const sm = novaPx("small", scale);
  const md = novaPx("medium", scale);
  const lg = novaPx("large", scale);
  const xl = novaPx("xlarge", scale);
  const circle = scale === 0 ? 0 : 9999;

  return `/* firefox-better:corners ${scale}% of Nova (xsmall ${xs}px … xlarge ${xl}px) */
:root {
  --border-radius-xsmall: ${xs}px !important;
  --border-radius-small: ${sm}px !important;
  --border-radius-medium: ${md}px !important;
  --border-radius-large: ${lg}px !important;
  --border-radius-xlarge: ${xl}px !important;
  --border-radius-circle: ${circle}px !important;
  --tab-border-radius: ${sm}px !important;
  --toolbarbutton-border-radius: ${sm}px !important;
  --button-border-radius: ${sm}px !important;
  --urlbar-icon-border-radius: ${sm}px !important;
  --arrowpanel-border-radius: ${md}px !important;
  --panel-border-radius: ${md}px !important;
  --panel-menuitem-border-radius: ${sm}px !important;
  --menuitem-border-radius: ${sm}px !important;
  --popup-border-radius: ${md}px !important;
  --input-text-border-radius: ${sm}px !important;
  --card-border-radius: ${sm}px !important;
  --card-border-radius-compact: ${sm}px !important;
}

#urlbar-background,
#urlbar,
.urlbar-input-container,
.tab-background,
.tab-group-label,
toolbarbutton,
toolbaritem,
menupopup,
panel,
.panel-viewstack,
.toolbarbutton-1,
.toolbarbutton-icon,
.toolbarbutton-badge-stack {
  border-radius: ${md}px !important;
}`;
}

function applyRadiusToUserChrome(base, scale) {
  const inner = radiusChromeCss(scale).trim();
  const block = `${CORNERS_START}\n${inner}\n${CORNERS_END}`;
  const start = base.indexOf(CORNERS_START);
  const end = base.indexOf(CORNERS_END);
  if (start === -1 || end === -1 || end < start) {
    return `${block}\n${base}`;
  }
  return `${base.slice(0, start)}${block}${base.slice(end + CORNERS_END.length)}`;
}

function radiusContentCss(scale) {
  if (scale >= RADIUS_MAX) {
    return "/* Nova rounding on about: pages. No Night Better radius override. */\n";
  }

  const xs = novaPx("xsmall", scale);
  const sm = novaPx("small", scale);
  const md = novaPx("medium", scale);
  const lg = novaPx("large", scale);
  const xl = novaPx("xlarge", scale);
  const circle = scale === 0 ? 0 : 9999;

  return `/* Firefox Better — corner radius ${scale}% of Nova on built-in pages (about:, settings). */

@-moz-document url-prefix("about:"), url-prefix("chrome:") {
  :root {
    --border-radius-xsmall: ${xs}px !important;
    --border-radius-small: ${sm}px !important;
    --border-radius-medium: ${md}px !important;
    --border-radius-large: ${lg}px !important;
    --border-radius-xlarge: ${xl}px !important;
    --border-radius-circle: ${circle}px !important;
    --button-border-radius: ${sm}px !important;
    --input-text-border-radius: ${sm}px !important;
    --card-border-radius: ${sm}px !important;
    --card-border-radius-compact: ${sm}px !important;
  }

  button,
  input,
  select,
  textarea,
  .card,
  .toggle-button {
    border-radius: ${md}px !important;
  }
}
`;
}

async function getState() {
  const stored = await browser.storage.local.get({
    proxyEnabled: DEFAULTS.proxyEnabled,
    lastProxyType: DEFAULTS.lastProxyType,
    hideShare: DEFAULTS.hideShare,
    squareCorners: true,
  });
  const extra = await browser.storage.local.get("radiusScale");
  const merged = { ...DEFAULTS, ...stored, ...extra };
  merged.radiusScale = radiusFromStorage({ ...stored, ...extra });
  return merged;
}

function isProxyOn(value) {
  return Boolean(value && value.proxyType && value.proxyType !== "none");
}

function cloneProxyValue(value) {
  const cloned = {};
  for (const key of PROXY_KEYS) {
    if (value && Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined) {
      cloned[key] = value[key];
    }
  }
  return cloned;
}

function endpointLabel(value) {
  if (!value) {
    return "";
  }
  return value.socks || value.http || value.ssl || "";
}

function typeLabel(proxyType) {
  if (proxyType === "none") {
    return "No proxy";
  }
  if (proxyType === "system") {
    return "System";
  }
  if (proxyType === "autoDetect") {
    return "Auto-detect";
  }
  if (proxyType === "manual") {
    return "Manual";
  }
  if (proxyType === "autoConfig") {
    return "PAC";
  }
  return proxyType || "Unknown";
}

function splitHostPort(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  let s = raw.trim();
  if (!s) {
    return null;
  }
  s = s.replace(/^(https?|socks[45]?):\/\//i, "");
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end !== -1) {
      const host = s.slice(1, end);
      const port = s[end + 1] === ":" ? s.slice(end + 2) : "";
      return { host, port };
    }
  }
  const idx = s.lastIndexOf(":");
  if (idx === -1) {
    return { host: s, port: "" };
  }
  return { host: s.slice(0, idx), port: s.slice(idx + 1) };
}

function joinHostPort(host, port) {
  const h = String(host || "").trim();
  const p = String(port || "").trim();
  if (!h) {
    return "";
  }
  if (h.startsWith("[")) {
    return p ? `${h}:${p}` : h;
  }
  return p ? `${h}:${p}` : h;
}

function formFromValue(value) {
  const empty = { host: "", port: "" };
  const http = splitHostPort(value?.http) || empty;
  const ssl = splitHostPort(value?.ssl) || empty;
  const socks = splitHostPort(value?.socks) || empty;
  const socksVersion = value?.socksVersion === 4 ? 4 : 5;
  const proxyDNS =
    typeof value?.proxyDNS === "boolean" ? value.proxyDNS : socksVersion !== 4;
  return {
    proxyType: value?.proxyType || "none",
    httpHost: http.host,
    httpPort: http.port,
    sslHost: ssl.host,
    sslPort: ssl.port,
    socksHost: socks.host,
    socksPort: socks.port,
    socksVersion,
    httpProxyAll: Boolean(value?.httpProxyAll),
    passthrough: value?.passthrough || "",
    autoConfigUrl: value?.autoConfigUrl || "",
    autoLogin: Boolean(value?.autoLogin),
    proxyDNS,
  };
}

function valueFromForm(current, form) {
  const next = cloneProxyValue(current);
  const http = joinHostPort(form.httpHost, form.httpPort);
  const ssl = form.httpProxyAll ? http : joinHostPort(form.sslHost, form.sslPort);
  next.proxyType = form.proxyType || "none";
  next.http = http;
  next.ssl = ssl;
  next.socks = joinHostPort(form.socksHost, form.socksPort);
  next.httpProxyAll = Boolean(form.httpProxyAll);
  next.socksVersion = Number(form.socksVersion) === 4 ? 4 : 5;
  next.passthrough = String(form.passthrough || "");
  next.autoConfigUrl = String(form.autoConfigUrl || "");
  next.autoLogin = Boolean(form.autoLogin);
  next.proxyDNS = Boolean(form.proxyDNS);
  return next;
}

function addEndpointRows(rows, label, raw) {
  const parts = splitHostPort(raw);
  if (!parts) {
    return;
  }
  rows.push({ label: `${label} host`, value: parts.host });
  if (parts.port) {
    rows.push({ label: `${label} port`, value: parts.port });
  }
}

function proxyDetails(value) {
  if (!value) {
    return [];
  }

  const rows = [{ label: "Type", value: typeLabel(value.proxyType) }];
  addEndpointRows(rows, "HTTP", value.http);
  if (value.ssl && value.ssl !== value.http) {
    addEndpointRows(rows, "HTTPS", value.ssl);
  }
  addEndpointRows(rows, "SOCKS", value.socks);
  if (value.socks && value.socksVersion) {
    rows.push({ label: "SOCKS version", value: String(value.socksVersion) });
  }
  if (value.httpProxyAll) {
    rows.push({ label: "HTTP for all", value: "Yes" });
  }
  if (value.autoConfigUrl) {
    rows.push({ label: "PAC URL", value: value.autoConfigUrl });
  }
  if (value.passthrough) {
    rows.push({ label: "No proxy for", value: value.passthrough });
  }
  if (typeof value.proxyDNS === "boolean") {
    rows.push({ label: "Proxy DNS", value: value.proxyDNS ? "On" : "Off" });
  }
  return rows;
}

function proxySummary(value) {
  const endpoint = endpointLabel(value);
  if (!value || value.proxyType === "none") {
    return endpoint ? `Off · ${endpoint}` : "Off";
  }
  if (value.proxyType === "autoConfig") {
    return value.autoConfigUrl ? `PAC ${value.autoConfigUrl}` : "PAC";
  }
  if (value.proxyType === "system") {
    return "System proxy";
  }
  if (value.proxyType === "autoDetect") {
    return "Auto-detect";
  }
  return endpoint || "Manual";
}

function typeToEnable(value, lastProxyType) {
  if (value && value.proxyType && value.proxyType !== "none") {
    return value.proxyType;
  }
  if (lastProxyType && lastProxyType !== "none") {
    return lastProxyType;
  }
  if (value && value.autoConfigUrl) {
    return "autoConfig";
  }
  if (value && (value.socks || value.http || value.ssl)) {
    return "manual";
  }
  return "system";
}

async function readBrowserProxyValue() {
  try {
    const { value } = await browser.proxy.settings.get({});
    return value || null;
  } catch (error) {
    return null;
  }
}

async function allowedIncognito() {
  return browser.extension.isAllowedIncognitoAccess();
}

async function getDisplayState() {
  const stored = await getState();
  const live = await readBrowserProxyValue();
  return {
    ...stored,
    proxyEnabled: isProxyOn(live),
    summary: proxySummary(live),
    details: proxyDetails(live),
    config: formFromValue(live),
  };
}

async function setBrowserProxyType(value) {
  const allowed = await allowedIncognito();
  if (!allowed) {
    throw new Error(PRIVATE_WINDOWS_ERROR);
  }

  applyingProxy += 1;
  try {
    const updated = await browser.proxy.settings.set({ value });
    if (updated === false) {
      throw new Error(
        "Firefox did not apply the proxy setting. In about:addons, next to Night Better open ... → Manage, then set Run in Private Windows to Allow."
      );
    }
  } finally {
    setTimeout(() => {
      applyingProxy = Math.max(0, applyingProxy - 1);
    }, 1500);
  }
}

async function setProxyEnabled(enabled) {
  const current = cloneProxyValue((await readBrowserProxyValue()) || {});
  const stored = await getState();
  let lastProxyType = stored.lastProxyType;

  if (enabled) {
    const proxyType = typeToEnable(current, lastProxyType);
    await setBrowserProxyType({ ...current, proxyType });
    lastProxyType = proxyType;
  } else {
    if (current.proxyType && current.proxyType !== "none") {
      lastProxyType = current.proxyType;
    }
    await setBrowserProxyType({ ...current, proxyType: "none" });
  }

  await browser.storage.local.set({
    proxyEnabled: Boolean(enabled),
    lastProxyType,
    proxyRevision: Date.now(),
  });
  const next = await getDisplayState();
  await updateTitle(next);
  return next;
}

async function toggleProxy() {
  const state = await getDisplayState();
  return setProxyEnabled(!state.proxyEnabled);
}

async function setProxyConfig(form) {
  const current = cloneProxyValue((await readBrowserProxyValue()) || {});
  const next = valueFromForm(current, form || {});
  await setBrowserProxyType(next);
  await browser.storage.local.set({
    proxyEnabled: isProxyOn(next),
    lastProxyType:
      next.proxyType && next.proxyType !== "none"
        ? next.proxyType
        : (await getState()).lastProxyType,
    proxyRevision: Date.now(),
  });
  const state = await getDisplayState();
  await updateTitle(state);
  return state;
}

async function updateTitle(state) {
  const on = Boolean(state.proxyEnabled);
  await browser.action.setBadgeText({ text: on ? "ON" : "" });
  await browser.action.setBadgeBackgroundColor({ color: "#3a3a3a" });
  await browser.action.setBadgeTextColor({ color: "#e8e8e8" });
  await browser.action.setTitle({
    title: on ? `Proxy on (${state.summary})` : "Proxy off",
  });
}

async function initMenus() {
  await browser.menus.removeAll();
  browser.menus.create({
    id: "toggle-proxy",
    title: "Toggle proxy",
    contexts: ["action"],
  });
  browser.menus.create({
    id: "open-options",
    title: "Proxy settings",
    contexts: ["action"],
  });
  browser.menus.create({
    id: "open-chrome",
    title: "Chrome CSS setup",
    contexts: ["action"],
  });
}

async function refreshDisplay() {
  const state = await getDisplayState();
  await updateTitle(state);
  return state;
}

async function boot() {
  await refreshDisplay();
  await initMenus();
}

browser.runtime.onInstalled.addListener(() => {
  boot().catch(() => {});
});

browser.runtime.onStartup.addListener(() => {
  boot().catch(() => {});
});

try {
  browser.proxy.settings.onChange.addListener(async () => {
    if (applyingProxy) {
      return;
    }
    try {
      await refreshDisplay();
    } catch (error) {
      console.warn(error.message);
    }
  });
} catch (error) {
  console.warn(error.message);
}

boot().catch(() => {});

browser.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "toggle-proxy") {
    try {
      await toggleProxy();
    } catch (error) {
      console.warn(error.message);
    }
    return;
  }
  if (info.menuItemId === "open-options" || info.menuItemId === "open-chrome") {
    await browser.runtime.openOptionsPage();
  }
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === "get-state") {
    return { state: await getDisplayState(), allowed: await allowedIncognito() };
  }

  if (message.type === "toggle-proxy") {
    try {
      const state = await (typeof message.proxyEnabled === "boolean"
        ? setProxyEnabled(message.proxyEnabled)
        : toggleProxy());
      return { state, allowed: await allowedIncognito() };
    } catch (error) {
      return {
        error: error.message || String(error),
        state: await getDisplayState(),
        allowed: await allowedIncognito(),
      };
    }
  }

  if (message.type === "set-proxy-config") {
    try {
      const state = await setProxyConfig(message.config);
      return { state, allowed: await allowedIncognito() };
    } catch (error) {
      return {
        error: error.message || String(error),
        state: await getDisplayState(),
        allowed: await allowedIncognito(),
      };
    }
  }

  if (message.type === "set-chrome-prefs") {
    const radiusScale = clampRadiusScale(
      message.radiusScale ?? (await getState()).radiusScale
    );
    await browser.storage.local.set({
      radiusScale,
      hideShare: message.hideShare !== false,
    });
    return { state: await getDisplayState() };
  }

  if (message.type === "chrome-css") {
    const state = await getState();
    const scale = clampRadiusScale(message.radiusScale ?? state.radiusScale);
    const base = await (await fetch(browser.runtime.getURL("chrome/userChrome.css"))).text();
    const userChrome = applyRadiusToUserChrome(base, scale);
    const userContent = radiusContentCss(scale);
    return { userChrome, userContent, radiusScale: scale };
  }

  return undefined;
});
