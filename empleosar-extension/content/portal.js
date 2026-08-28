// Content script que corre en los portales de empleo (Computrabajo,
// ZonaJobs, LinkedIn). Cuando hay una postulación pendiente disparada
// desde EmpleosAR, muestra un panel flotante:
//  - Si la página es la oferta: pulsa el botón "Postularme" del portal
//    para ir al formulario (nunca envía el formulario por vos).
//  - Si la página tiene formulario: adjunta el CV generado al campo de
//    archivo apenas aparece; el usuario completa el resto y envía.
//  - Detecta la confirmación del portal y avisa al service worker para
//    que la web marque el aviso como Aplicado.

(() => {
  let pending = null;

  const RE_CTA = /^(postular(me|se)?|apply)$/i;
  const RE_SUCCESS =
    /postulaci[oó]n (fue )?(recibida|enviada)|te postulaste|ya (te )?aplicaste|postulaci[oó]n confirmada|application submitted|has applied/i;

  // El texto de éxito no siempre aparece; la URL de confirmación tampoco es
  // uniforme. Solo matcheamos patrones concretos por portal para no marcar
  // como enviada una postulación que está en el formulario ("apply" aparece
  // en URLs de LinkedIn con el form todavía abierto).
  function successUrlMatches() {
    const host = location.hostname.toLowerCase().replace(/^www\./, "");
    const path = location.pathname.toLowerCase();
    const hash = (location.hash || "").toLowerCase();
    if (host.includes("computrabajo")) {
      return /postulad|aplicad|env/ .test(path) || /submit/.test(hash);
    }
    if (host.includes("zonajobs")) {
      return /postulad|aplicad|env/.test(path) || /submit/.test(hash);
    }
    if (host.includes("linkedin")) {
      // LinkedIn confirma en un step/URL final, no en "/apply".
      return /thank-you|confirmation|postulac/.test(path) || /submitted/.test(hash);
    }
    return false;
  }

  // Algunos portales tienen más de un campo de archivo (foto, otros
  // adjuntos). Preferimos el que acepte PDF o referencie el CV antes que
  // tomar el primero.
  function findFileInput() {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    const byHint = inputs.find((i) => {
      const hint = `${i.name} ${i.id} ${i.getAttribute("aria-label") ?? ""}`.toLowerCase();
      return /cv|curriculum|hoja de vida|resume|adjuntar archivo/.test(hint);
    });
    if (byHint) return byHint;
    const byAccept = inputs.find((i) => (i.accept || "").toLowerCase().includes("pdf"));
    return byAccept ?? inputs[0] ?? null;
  }

  function isVisible(el) {
    if (!el.isConnected) return false;
    return !!(el.getClientRects().length || el.offsetParent);
  }

  // CTA del portal para ir al formulario ("Postularme", "Apply", ...).
  // Solo match exacto del texto para no pulsar "Enviar"/"Continuar".
  function findCta() {
    const candidates = [
      ...document.querySelectorAll("a, button, [role=button], input[type=submit]"),
    ];
    for (const el of candidates) {
      const text = (el.innerText ?? el.value ?? "").trim();
      if (RE_CTA.test(text) && isVisible(el)) return el;
    }
    return null;
  }

  async function fetchCv() {
    return chrome.runtime.sendMessage({ type: "GET_CV" });
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function attachCv() {
    const input = findFileInput();
    if (!input) return false;
    const cv = await fetchCv();
    if (!cv || !cv.base64 || !cv.filename) return false;
    try {
      const file = new File([base64ToBytes(cv.base64)], cv.filename, { type: "application/pdf" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Arquitectura de CV en portal: algunos portales (Computrabajo sobre
  // todo) arman la postulación con el CV del PERFIL y no exponen un
  // input[type=file] en el formulario; el editor de CV se abre con un
  // botón "Editar"/"Cambiar CV" (a veces un modal). Este helper clickea ese
  // botón una vez y espera a que el input de archivo aparezca en el DOM.
  // Solo se usa dentro de un click del usuario (user gesture).
  async function tryRevealCvEditor() {
    if (findFileInput()) return true;
    const RE_EDIT = /editar|cambiar|actualizar|subir|agregar|adjuntar/i;
    const RE_EDIT_TEXT = /cv|curriculum|hoja de vida|resume|curr[ií]culum/i;
    const RE_SUBMIT = /^(actualizar|enviar|postular|continuar|guardar|siguiente|publicar|confirmar)$/i;
    const candidates = [
      ...document.querySelectorAll("a, button, [role=button], input[type=submit], label"),
    ];
    for (const el of candidates) {
      const text = (el.innerText ?? el.value ?? el.getAttribute("aria-label") ?? "").trim();
      if (!text || text.length > 60) continue;
      if (RE_SUBMIT.test(text)) continue;
      const labelOk =
        RE_EDIT.test(text) || (RE_EDIT_TEXT.test(text) && /cv|attach|file/i.test(text.toLowerCase()));
      if (!labelOk || !isVisible(el)) continue;
      try {
        el.click();
      } catch {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
      await sleep(1100);
      return !!findFileInput();
    }
    return false;
  }

  function sendApplied() {
    chrome.runtime.sendMessage({ type: "MARK_APPLIED" }, (res) => {
      if (res && res.ok) setStatus("Aplicado en EmpleosAR ✓", true);
    });
  }

  function watchSuccess() {
    let done = false;
    const onSuccess = () => {
      if (done) return;
      done = true;
      sendApplied();
    };
    const ok = (text) => (text ? RE_SUCCESS.test(text) : false);
    const observer = new MutationObserver(() => {
      if (!done && ok(document.body && document.body.innerText)) onSuccess();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const urlCheck = setInterval(() => {
      if (!done && successUrlMatches()) onSuccess();
    }, 1500);
    window.addEventListener("hashchange", () => {
      if (!done && successUrlMatches()) onSuccess();
    });
    return () => {
      observer.disconnect();
      clearInterval(urlCheck);
    };
  }

  let setStatus = () => {};

  function mountPanel(meta) {
    const host = document.createElement("div");
    host.id = "trabajoteca-autoapply-host";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .tt-panel {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
        width: 300px; background: #1e1e2e; color: #e5e5ef; border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,.35); font: 13px/1.4 system-ui, sans-serif;
        padding: 14px 16px; box-sizing: border-box;
      }
      .tt-title { font-weight: 700; margin-bottom: 2px; }
      .tt-sub { color: #a0a0b8; font-size: 12px; margin-bottom: 10px; }
      .tt-status { font-size: 12px; min-height: 16px; margin-bottom: 10px; }
      .tt-status.ok { color: #6ee7a0; }
      .tt-row { display: flex; gap: 8px; }
      .tt-btn {
        flex: 1; border: 0; border-radius: 8px; padding: 8px 10px; cursor: pointer;
        font: inherit; font-weight: 600; text-align: center;
      }
      .tt-btn.primary { background: #6366f1; color: #fff; }
      .tt-btn.ghost { background: #2a2a40; color: #e5e5ef; }
      .tt-btn:disabled { opacity: .5; cursor: default; }
    `;
    const panel = document.createElement("div");
    panel.className = "tt-panel";
    panel.innerHTML = `
      <div class="tt-title">EmpleosAR</div>
      <div class="tt-sub">${escapeHtml(meta.title)}${
        meta.company ? " · " + escapeHtml(meta.company) : ""
      }</div>
      <div class="tt-status">CV listo para adjuntar.</div>
      <div class="tt-row">
        <button class="tt-btn primary" data-act="attach">Adjuntar CV</button>
        <button class="tt-btn primary" data-act="go">Ir a postularme</button>
      </div>
      <div class="tt-row" style="margin-top:8px">
        <button class="tt-btn ghost" data-act="mark">Marqué que se envió</button>
      </div>
    `;
    shadow.appendChild(style);
    shadow.appendChild(panel);

    const statusEl = panel.querySelector(".tt-status");
    const attachBtn = panel.querySelector('[data-act="attach"]');
    const goBtn = panel.querySelector('[data-act="go"]');
    const markBtn = panel.querySelector('[data-act="mark"]');

    setStatus = (text, ok) => {
      statusEl.textContent = text;
      statusEl.className = "tt-status" + (ok ? " ok" : "");
    };

    attachBtn.addEventListener("click", async () => {
      mountAttach = true;
      attachBtn.disabled = true;
      let ok = await attachCv();
      if (!ok) {
        // Algunos portales guardan el CV en el perfil y lo exponen vía
        // "Editar". Abrimos ese editor (con el user gesture del click) y
        // reintentamos adjuntar.
        setStatus("Buscando el editor de CV del portal...");
        ok = await tryRevealCvEditor();
        if (ok) ok = await attachCv();
      }
      attachBtn.disabled = false;
      if (ok) {
        setStatus("CV adjuntado. Completá el formulario y envialo vos.", true);
        attachBtn.textContent = "CV ✓";
      } else {
        setStatus(
          "El portal usa el CV de tu perfil y no hay campo para reemplazarlo acá. Cambialo en Tu perfil → CV de este portal.",
        );
      }
    });

    goBtn.addEventListener("click", async () => {
      const cta = findCta();
      if (!cta) {
        setStatus("No veo un botón 'Postularme' en esta página. Esperá a que cargue o tocá el botón del portal.");
        return;
      }
      setStatus("Abriendo el formulario de postulación...");
      cta.scrollIntoView({ block: "center" });
      try {
        cta.click();
      } catch {
        cta.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
    });

    markBtn.addEventListener("click", () => {
      setStatus("Avisando a EmpleosAR...");
      sendApplied();
    });

    document.body.appendChild(host);

    // El campo de archivo suele estar ya en el DOM cuando el portal arma el
    // formulario: adjuntamos sin esperar una mutación. Si el usuario usó el
    // botón antes, no pisamos su acción (mountAttach).
    let mountAttach = false;
    setTimeout(async () => {
      if (mountAttach) return;
      const ok = await attachCv();
      if (ok) {
        attachBtn.textContent = "CV ✓";
        setStatus("CV adjuntado. Completá el formulario y envialo vos.", true);
      } else if (!findFileInput()) {
        setStatus(
          "El portal puede usar el CV de tu perfil. Tocá 'Adjuntar CV' para intentar reemplazarlo.",
        );
      }
    }, 600);

    // Auto: en la página de la oferta, pulsa el CTA para ir al formulario.
    if (!findFileInput()) {
      setTimeout(() => {
        if (!findFileInput()) {
          const cta = findCta();
          if (cta) {
            setStatus("Abriendo el formulario de postulación...");
            try {
              cta.scrollIntoView({ block: "center" });
              cta.click();
            } catch {
              /* el usuario puede usar el botón del panel */
            }
          }
        }
      }, 1800);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // Adjunta el CV apenas aparece un campo de archivo (algunos portales lo
  // renderizan luego de avanzar el formulario o lo muestran con un botón).
  let lastInput = null;
  const attachObserver = new MutationObserver(() => {
    if (!pending) return;
    const input = findFileInput();
    if (!input || input === lastInput) return;
    if (input.files && input.files.length > 0) return;
    lastInput = input;
    attachCv().then((ok) => {
      if (ok) {
        setStatus("CV adjuntado. Completá el formulario y envialo vos.", true);
      } else {
        lastInput = null;
      }
    });
  });
  attachObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "style", "class", "aria-hidden"],
  });
  watchSuccess();

  chrome.runtime.sendMessage({ type: "HELLO_PORTAL" }, (res) => {
    if (res && res.pending) {
      pending = true;
      mountPanel(res);
    }
  });

  // El service worker re-monta el panel cuando la pestaña navega de la
  // oferta al formulario (portales multipágina: Computrabajo, ZonaJobs).
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "FORCE_PANEL" && !pending) {
      pending = true;
      mountPanel(msg.meta || {});
    }
  });
})();