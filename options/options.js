const proxyEnabled = document.getElementById("proxy-enabled");
const proxyLabel = document.getElementById("proxy-label");
const proxySummary = document.getElementById("proxy-summary");
const proxyError = document.getElementById("proxy-error");
const proxyNotice = document.getElementById("proxy-private-notice");
const proxyHint = document.getElementById("proxy-hint");
const proxyDetails = document.getElementById("proxy-details");
const openAddons = document.getElementById("open-addons");
const openAddonsWrap = document.getElementById("open-addons-wrap");
const proxyForm = document.getElementById("proxy-form");
const proxyConfig = document.getElementById("proxy-config");
const proxyReload = document.getElementById("proxy-reload");
const proxyDnsLabel = document.getElementById("proxy-dns-label");
const radiusScale = document.getElementById("radius-scale");
const radiusValue = document.getElementById("radius-value");
const userChrome = document.getElementById("user-chrome");
const userContent = document.getElementById("user-content");
const copyStatus = document.getElementById("copy-status");

const PROXY_TYPES = ["none", "system", "autoDetect", "manual", "autoConfig"];

let filling = false;
let dirty = false;
let allowed = true;

function show(el, message, isError = false) {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function clampRadius(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

function setRadiusUi(value) {
  const scale = clampRadius(value);
  radiusScale.value = String(scale);
  radiusValue.value = String(scale);
  return scale;
}

function renderDetails(rows) {
  proxyDetails.replaceChildren();
  if (!rows || !rows.length) {
    proxyDetails.hidden = true;
    return;
  }
  proxyDetails.hidden = false;
  for (const row of rows) {
    const dt = document.createElement("dt");
    dt.textContent = row.label;
    const dd = document.createElement("dd");
    dd.textContent = row.value;
    proxyDetails.append(dt, dd);
  }
}

function setDisabled(selector, disabled) {
  for (const el of proxyForm.querySelectorAll(selector)) {
    el.disabled = disabled;
  }
}

function updateFieldEnablement() {
  const locked = !allowed;
  proxyConfig.disabled = false;
  const type = proxyForm.elements.proxyType.value;
  const manual = type === "manual";
  const pac = type === "autoConfig";
  const shareHttps = proxyForm.elements.httpProxyAll.checked;

  setDisabled('input[name="proxyType"]', locked);
  setDisabled("#manual-fields input", locked || !manual);
  setDisabled("#http-proxy-all", locked || !manual);
  setDisabled("#https-row input", locked || !manual || shareHttps);
  setDisabled("#passthrough", locked || !manual);
  setDisabled('input[name="socksVersion"]', locked || !manual);
  setDisabled("#auto-config-url", locked || !pac);
  proxyReload.disabled = locked || !pac;
  proxyForm.elements.autoLogin.disabled = locked;
  proxyForm.elements.proxyDNS.disabled = locked;

  const socksVersion = proxyForm.elements.socksVersion.value === "4" ? 4 : 5;
  proxyDnsLabel.textContent =
    socksVersion === 4
      ? "Proxy DNS when using SOCKS v4"
      : "Proxy DNS when using SOCKS v5";
}

function fillForm(config) {
  const cfg = config || {};
  filling = true;
  const type = PROXY_TYPES.includes(cfg.proxyType) ? cfg.proxyType : "none";
  proxyForm.elements.proxyType.value = type;
  proxyForm.elements.httpHost.value = cfg.httpHost || "";
  proxyForm.elements.httpPort.value = cfg.httpPort || "";
  proxyForm.elements.sslHost.value = cfg.sslHost || "";
  proxyForm.elements.sslPort.value = cfg.sslPort || "";
  proxyForm.elements.socksHost.value = cfg.socksHost || "";
  proxyForm.elements.socksPort.value = cfg.socksPort || "";
  proxyForm.elements.socksVersion.value = cfg.socksVersion === 4 ? "4" : "5";
  proxyForm.elements.httpProxyAll.checked = Boolean(cfg.httpProxyAll);
  proxyForm.elements.passthrough.value = cfg.passthrough || "";
  proxyForm.elements.autoConfigUrl.value = cfg.autoConfigUrl || "";
  proxyForm.elements.autoLogin.checked = Boolean(cfg.autoLogin);
  proxyForm.elements.proxyDNS.checked = Boolean(cfg.proxyDNS);
  filling = false;
  dirty = false;
  updateFieldEnablement();
}

function readForm() {
  return {
    proxyType: proxyForm.elements.proxyType.value || "none",
    httpHost: proxyForm.elements.httpHost.value,
    httpPort: proxyForm.elements.httpPort.value,
    sslHost: proxyForm.elements.sslHost.value,
    sslPort: proxyForm.elements.sslPort.value,
    socksHost: proxyForm.elements.socksHost.value,
    socksPort: proxyForm.elements.socksPort.value,
    socksVersion: proxyForm.elements.socksVersion.value === "4" ? 4 : 5,
    httpProxyAll: proxyForm.elements.httpProxyAll.checked,
    passthrough: proxyForm.elements.passthrough.value,
    autoConfigUrl: proxyForm.elements.autoConfigUrl.value,
    autoLogin: proxyForm.elements.autoLogin.checked,
    proxyDNS: proxyForm.elements.proxyDNS.checked,
  };
}

function renderProxy(state, allowedFlag = true, { fill = true } = {}) {
  allowed = Boolean(allowedFlag);
  proxyEnabled.checked = Boolean(state.proxyEnabled);
  proxyEnabled.disabled = !allowed;
  proxyLabel.textContent = !allowed ? "Locked" : state.proxyEnabled ? "On" : "Off";
  proxySummary.textContent = state.summary || (state.proxyEnabled ? "On" : "Off");
  renderDetails(state.details);
  proxyNotice.hidden = allowed;
  openAddonsWrap.hidden = allowed;
  proxyHint.hidden = !allowed;
  if (fill && !dirty) {
    fillForm(state.config);
  } else {
    updateFieldEnablement();
  }
  proxyForm.hidden = false;
  if (allowed) {
    show(proxyError, "");
  }
}

async function applyForm() {
  if (filling || !allowed) {
    return;
  }
  show(proxyError, "");
  try {
    const result = await browser.runtime.sendMessage({
      type: "set-proxy-config",
      config: readForm(),
    });
    if (result.error) {
      renderProxy(result.state, result.allowed, { fill: false });
      if (result.allowed) {
        show(proxyError, result.error, true);
      }
      return;
    }
    dirty = false;
    renderProxy(result.state, result.allowed, { fill: true });
  } catch (error) {
    show(proxyError, error.message || String(error), true);
  }
}

async function refreshCss(scale = radiusScale.value) {
  const result = await browser.runtime.sendMessage({
    type: "chrome-css",
    radiusScale: clampRadius(scale),
  });
  userChrome.value = result.userChrome;
  userContent.value = result.userContent;
}

async function commitRadius(value) {
  const scale = setRadiusUi(value);
  await browser.runtime.sendMessage({
    type: "set-chrome-prefs",
    radiusScale: scale,
    hideShare: true,
  });
  await refreshCss(scale);
}

async function load({ fill = true } = {}) {
  const { state, allowed: allowedFlag } = await browser.runtime.sendMessage({
    type: "get-state",
  });
  renderProxy(state, allowedFlag, { fill });
  setRadiusUi(state.radiusScale);
  await refreshCss(state.radiusScale);
}

openAddons.addEventListener("click", async () => {
  await navigator.clipboard.writeText("about:addons");
  openAddons.textContent = "Copied. Paste it in the address bar.";
});

proxyEnabled.addEventListener("change", async () => {
  if (proxyEnabled.disabled) {
    return;
  }
  const wanted = proxyEnabled.checked;
  show(proxyError, "");
  try {
    const result = await browser.runtime.sendMessage({
      type: "toggle-proxy",
      proxyEnabled: wanted,
    });
    if (result.error) {
      renderProxy(result.state, result.allowed, { fill: !dirty });
      if (result.allowed) {
        show(proxyError, result.error, true);
      }
      return;
    }
    renderProxy(result.state, result.allowed, { fill: !dirty });
  } catch (error) {
    proxyEnabled.checked = !wanted;
    show(proxyError, error.message || String(error), true);
  }
});

proxyForm.addEventListener("change", (event) => {
  if (filling || !event.target || !event.target.name) {
    return;
  }
  updateFieldEnablement();
  applyForm().catch((error) => show(proxyError, error.message || String(error), true));
});

proxyForm.addEventListener("input", (event) => {
  if (filling || !event.target || !event.target.name) {
    return;
  }
  dirty = true;
});

proxyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyForm().catch((error) => show(proxyError, error.message || String(error), true));
});

proxyReload.addEventListener("click", () => {
  applyForm().catch((error) => show(proxyError, error.message || String(error), true));
});

radiusScale.addEventListener("input", () => {
  const scale = setRadiusUi(radiusScale.value);
  refreshCss(scale).catch((error) => show(copyStatus, error.message, true));
});

radiusScale.addEventListener("change", () => {
  commitRadius(radiusScale.value).catch((error) => show(copyStatus, error.message, true));
});

radiusValue.addEventListener("input", () => {
  const scale = setRadiusUi(radiusValue.value);
  refreshCss(scale).catch((error) => show(copyStatus, error.message, true));
});

radiusValue.addEventListener("change", () => {
  commitRadius(radiusValue.value).catch((error) => show(copyStatus, error.message, true));
});

document.getElementById("copy-chrome").addEventListener("click", async () => {
  await navigator.clipboard.writeText(userChrome.value);
  show(copyStatus, "userChrome.css copied.");
});

document.getElementById("copy-content").addEventListener("click", async () => {
  await navigator.clipboard.writeText(userContent.value);
  show(copyStatus, "userContent.css copied.");
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  if (changes.proxyEnabled || changes.lastProxyType || changes.proxyRevision) {
    load({ fill: !dirty }).catch((error) => show(proxyError, error.message, true));
  }
});

load({ fill: true }).catch((error) => {
  show(proxyError, error.message || String(error), true);
});
