// Content script que corre en la web (localhost:3000 por defecto).
//
// Anuncia la presencia de la extensión con pings (postMessage, sin tocar
// el DOM para no romper la hidratación de React) y traduce los postMessage
// de la página en mensajes al service worker. También reenvía la
// confirmación "Aplicado" del service worker hacia la página.

(() => {
  const PONG = "trabajoteca:pong";
  const POSTULATE = "trabajoteca:postulate";
  const POSTULATE_SENT = "trabajoteca:postulate-sent";
  const POSTULATE_ERROR = "trabajoteca:postulate-error";
  const APPLIED = "trabajoteca:applied";
  const PORTAL_CLOSED = "trabajoteca:portal-closed";

  let pings = 0;
  const pingId = setInterval(() => {
    pings++;
    window.postMessage({ type: PONG }, window.location.origin);
    if (pings > 30) clearInterval(pingId);
  }, 200);

  function safeFilename(title) {
    const t = (title ?? "trabajoteca")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);
    return `CV_${t}.pdf`;
  }

  // Chrome serializa los mensajes de la extensión con JSON, así que el CV
  // se transmite como base64 (los ArrayBuffer se pierden en JSON).
  function toBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function replyToPage(type, payload) {
    window.postMessage({ type, payload }, window.location.origin);
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== POSTULATE) return;

    const p = data.payload;
    if (!p || !p.jobId || !p.jobUrl || !p.cvUrl) return;

    let cvUrl;
    try {
      const job = new URL(p.jobUrl, window.location.origin);
      if (job.protocol !== "http:" && job.protocol !== "https:") return;
      cvUrl = new URL(p.cvUrl, window.location.origin);
      if (cvUrl.origin !== window.location.origin) {
        replyToPage(POSTULATE_ERROR, {
          jobId: p.jobId,
          error: "El CV debe servirse desde este sitio.",
        });
        return;
      }
    } catch {
      return;
    }

    fetch(cvUrl.href, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.arrayBuffer();
      })
      .then((buffer) =>
        chrome.runtime
          .sendMessage({
            type: "POSTULATE",
            payload: {
              jobId: p.jobId,
              jobUrl: p.jobUrl,
              title: p.title ?? "",
              company: p.company ?? "",
              source: p.source ?? "",
              cvBase64: toBase64(new Uint8Array(buffer)),
              cvFilename: safeFilename(p.title),
            },
          })
          .then((res) => {
            if (res && res.ok) {
              replyToPage(POSTULATE_SENT, { jobId: p.jobId });
            } else {
              replyToPage(POSTULATE_ERROR, {
                jobId: p.jobId,
                error: "La extensión no pudo abrir el aviso. Intentá de nuevo.",
              });
            }
          })
          .catch(() => {
            replyToPage(POSTULATE_ERROR, {
              jobId: p.jobId,
              error: "No se pudo enviar el CV a la extensión. Volvé a intentar.",
            });
          }),
      )
      .catch(() => {
        replyToPage(POSTULATE_ERROR, {
          jobId: p.jobId,
          error: "No se pudo leer el CV generado. Volvé a intentar.",
        });
      });
  });

  // Registra el estado en el servidor para que lo refleje la web aunque la
  // pestaña de EmpleosAR no tenga el estado montado en ese momento. Solo
  // sirve con sesión iniciada; si falla, la marca local de la página igual
  // se actualiza y el usuario puede reintentar.
  const reportedJobIds = new Set();

  async function reportAppliedToServer(jobId) {
    if (reportedJobIds.has(jobId)) return;
    try {
      const res = await fetch("/api/extension/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobId, status: "APPLIED" }),
      });
      if (res.ok) reportedJobIds.add(jobId);
    } catch {
      // Sin conexión o sesión: la web igual actualiza el estado en la UI
      // vía el mensaje "aplicado" que ya se reenvió a la página.
    }
  }

  const notifiedJobIds = new Set();

  function onApplied(jobId) {
    if (notifiedJobIds.has(jobId)) return;
    notifiedJobIds.add(jobId);
    replyToPage(APPLIED, { jobId });
    reportAppliedToServer(jobId);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === APPLIED && msg.payload && msg.payload.jobId) {
      onApplied(msg.payload.jobId);
    }
    if (msg && msg.type === PORTAL_CLOSED && msg.payload && msg.payload.jobId) {
      replyToPage(PORTAL_CLOSED, { jobId: msg.payload.jobId });
    }
  });

  // Vía de fallback/robustez: el service worker marca la postulación como
  // applied en chrome.storage.session; reaccionamos acá para avisar a la
  // página sin depender de que la pestaña sea encontrada por tabs.query.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session") return;
    for (const key of Object.keys(changes)) {
      if (!key.startsWith("tt_pending_")) continue;
      const entry = changes[key].newValue;
      if (entry && entry.applied && entry.jobId) {
        onApplied(entry.jobId);
      }
    }
  });
})();