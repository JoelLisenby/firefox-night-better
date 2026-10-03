const proxyEnabled = document.getElementById("proxy-enabled");
const proxyLabel = document.getElementById("proxy-label");
const proxySummary = document.getElementById("proxy-summary");
const proxyError = document.getElementById("proxy-error");
const proxyNotice = document.getElementById("proxy-private-notice");
const proxyHint = document.getElementById("proxy-hint");
const proxyDetails = document.getElementById("proxy-details");
const openAddons = document.getElementById("open-addons");

function showError(el, message) {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
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

function renderProxy(state, allowed) {
  proxyEnabled.checked = Boolean(state.proxyEnabled);
  proxyEnabled.disabled = !allowed;
  proxyLabel.textContent = !allowed ? "Locked" : state.proxyEnabled ? "On" : "Off";
  proxySummary.textContent = state.summary || (state.proxyEnabled ? "On" : "Off");
  renderDetails(state.details);
  proxyNotice.hidden = allowed;
  openAddons.hidden = allowed;
  proxyHint.hidden = !allowed;
  if (allowed) {
    showError(proxyError, "");
  }
}

async function load() {
  const { state, allowed } = await browser.runtime.sendMessage({
    type: "get-state",
  });
  renderProxy(state, allowed);
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
  showError(proxyError, "");
  try {
    const result = await browser.runtime.sendMessage({
      type: "toggle-proxy",
      proxyEnabled: wanted,
    });
    if (result.error) {
      renderProxy(result.state, result.allowed);
      if (result.allowed) {
        showError(proxyError, result.error);
      }
      return;
    }
    renderProxy(result.state, result.allowed);
  } catch (error) {
    proxyEnabled.checked = !wanted;
    showError(proxyError, error.message || String(error));
  }
});

document.getElementById("open-proxy").addEventListener("click", async () => {
  await browser.runtime.openOptionsPage();
  window.close();
});

document.getElementById("open-options").addEventListener("click", async () => {
  await browser.runtime.openOptionsPage();
  window.close();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.proxyEnabled || changes.lastProxyType || changes.proxyRevision)
  ) {
    load().catch((error) => showError(proxyError, error.message));
  }
});

load().catch((error) => showError(proxyError, error.message));
