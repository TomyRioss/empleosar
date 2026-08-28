// Service worker de la extensión EmpleosAR Auto-Apply.
//
// Flujo:
//  1. La web postula un aviso (POSTULATE) con el CV en bytes.
//  2. Se guarda la postulación pendiente y se abre el aviso original.
//  3. El content script del portal pide el CV (GET_CV), lo adjunta y
//     detecta el envío (MARK_APPLIED).
//  4. Se notifica a todas las pestañas abiertas de la web para que
//     marquen el aviso como Aplicado.

const PREFIX = "tt_pending_";

// Computrabajo usa varios dominios para el mismo portal (www.computrabajo.com.ar,
// ar.computrabajo.com, computrabajo.com). Los tratamos como equivalentes.
function hostKey(host) {
  const h = String(host).toLowerCase().replace(/^www\./, "");
  if (h === "computrabajo.com.ar" || h === "ar.computrabajo.com" || h === "computrabajo.com") {
    return "computrabajo";
  }
  return h;
}

// Normaliza una URL a hostKey + pathname, ignorando queries/params de tracking.
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return hostKey(u.hostname) + u.pathname;
  } catch {
    return url;
  }
}

// Los mensajes de la extensión viajan JSON-serializados (no hay structured
// clone), así que los binarios solo pueden moverse como base64 strings.
function isBase64B64(s) {
  return typeof s === "string" && s.length > 0;
}

async function findPendingForUrl(url) {
  const norm = normalizeUrl(url);
  const all = await chrome.storage.session.get(null);
  for (const [key, entry] of Object.entries(all)) {
    if (!key.startsWith(PREFIX)) continue;
    const stored = normalizeUrl(entry.jobUrl);
    // El portal puede redirigir (www -> dominio local, slug canónico), así que
    // matcheamos host equivalente y path igual o, si el aviso tiene path largo,
    // que el path real termine con el path guardado.
    const sameHost = norm.startsWith(stored.split("/")[0]);
    const samePath = norm === stored || (stored.length > 8 && norm.endsWith(stored));
    if (sameHost && samePath) return entry;
  }
  return null;
}

async function notifyWebOfApplied(entry) {
  const tabs = await chrome.tabs.query({});
  const webOrigin = entry.webOrigin;
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !webOrigin) continue;
    let origin;
    try {
      origin = new URL(tab.url).origin;
    } catch {
      continue;
    }
    if (origin !== webOrigin) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "trabajoteca:applied",
        payload: { jobId: entry.jobId },
      });
    } catch {
      // La pestaña de la web puede no tener el content script (recarga en curso).
    }
  }
}

// Cuando el portal navega a una URL nueva (oferta -> formulario) el content
// script se reinyecta y ya no matchea HELLO_PORTAL (la URL cambió). Como la
// postulación sigue pendiente en esa pestaña, forzamos el panel para que el
// CV generado se adjunte también en el formulario.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "complete") return;
  chrome.storage.session.get(null).then((all) => {
    for (const [key, entry] of Object.entries(all)) {
      if (!key.startsWith(PREFIX)) continue;
      if (entry.applied || !entry.tabId || entry.tabId !== tabId) continue;
      chrome.tabs
        .sendMessage(tabId, {
          type: "FORCE_PANEL",
          meta: { title: entry.title, company: entry.company },
        })
        .catch(() => {
          // El content script puede no estar listo todavía.
        });
      return;
    }
  });
});

// Si el usuario cierra la pestaña del portal sin confirmar la postulación,
// la web queda esperando "aplicado" para siempre. Avisamos que el aviso se
// cerró para que la página vuelva a "idle" y limpiemos la entrada.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.get(null).then((all) => {
    for (const [key, entry] of Object.entries(all)) {
      if (!key.startsWith(PREFIX)) continue;
      if (entry.applied || entry.tabId !== tabId) continue;
      notifyWeb(entry, "trabajoteca:portal-closed", { jobId: entry.jobId });
      chrome.storage.session.remove(key);
    }
  });
});

function notifyWeb(entry, type, payload) {
  if (!entry.webOrigin) return;
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (!tab.id || !tab.url || !entry.webOrigin) continue;
      let origin;
      try {
        origin = new URL(tab.url).origin;
      } catch {
        continue;
      }
      if (origin !== entry.webOrigin) continue;
      chrome.tabs
        .sendMessage(tab.id, { type, payload })
        .catch(() => {
          // La pestaña puede no tener el content script (recarga en curso).
        });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "POSTULATE": {
      const p = msg.payload;
      if (!p || !p.jobUrl) return;
      if (!isBase64B64(p.cvBase64)) {
        sendResponse({ ok: false });
        return;
      }
      const key = PREFIX + normalizeUrl(p.jobUrl);
      const entry = {
        jobId: p.jobId,
        jobUrl: p.jobUrl,
        title: p.title ?? "",
        company: p.company ?? "",
        source: p.source ?? "",
        cvFilename: p.cvFilename ?? "CV.pdf",
        cvBase64: p.cvBase64,
        webOrigin: sender.tab?.url ? new URL(sender.tab.url).origin : "",
        applied: false,
        tabId: null,
      };
      chrome.storage.session
        .set({ [key]: entry })
        .then(() => chrome.tabs.create({ url: p.jobUrl, active: true }))
        .then((tab) => {
          // Recordamos la pestaña para poder re-montar el panel cuando el
          // portal navegue de la oferta al formulario (multipágina).
          if (tab && tab.id) {
            entry.tabId = tab.id;
            return chrome.storage.session.set({ [key]: entry });
          }
        })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    case "HELLO_PORTAL": {
      const url = sender.tab?.url ?? "";
      findPendingForUrl(url).then((entry) => {
        sendResponse(
          entry && !entry.applied
            ? { pending: true, title: entry.title, company: entry.company }
            : { pending: false },
        );
      });
      return true;
    }

    case "GET_CV": {
      const url = sender.tab?.url ?? "";
      findPendingForUrl(url).then((entry) => {
        if (!entry || entry.applied) {
          sendResponse(null);
          return;
        }
        sendResponse({
          filename: entry.cvFilename,
          base64: entry.cvBase64,
        });
      });
      return true;
    }

    case "MARK_APPLIED": {
      const url = sender.tab?.url ?? "";
      findPendingForUrl(url).then((entry) => {
        if (!entry || entry.applied) {
          sendResponse({ ok: false });
          return;
        }
        entry.applied = true;
        chrome.storage.session
          .set({ [PREFIX + normalizeUrl(entry.jobUrl)]: entry })
          .then(() => notifyWebOfApplied(entry))
          .then(() => sendResponse({ ok: true }))
          .catch(() => sendResponse({ ok: false }));
      });
      return true;
    }
  }
});