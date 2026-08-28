# Extensión EmpleosAR Auto-Apply

Extensión de Chrome/Edge (Manifest V3) que postula el CV generado en
EmpleosAR desde el navegador del usuario, con su sesión real en cada
portal. Opcional: la web funciona igual sin ella.

## Instalación (dev)

1. `git clone` del repo (ya tenés el código en `empleosar-extension/`).
2. Abrí `chrome://extensions` (o `edge://extensions`).
3. Activá **Modo de desarrollador**.
4. **Cargar descomprimida** → seleccioná la carpeta `empleosar-extension/`.
5. En `empleosar-extension/manifest.json`, agregá el dominio de producción
   de EmpleosAR a `content_scripts[0].matches` y `host_permissions`
   (actualmente solo `http://localhost:3000/*`).

## Uso

1. En EmpleosAR, generá el CV de un aviso (botón "Generar CV...").
2. Aparece "Postular con extensión": abre el aviso en el portal, adjunta
   el CV al formulario y detecta el envío.
3. Cuando el portal confirma la postulación, el aviso se marca como
   **Aplicado** en EmpleosAR automáticamente.
4. Si el portal no confirma solo, el panel flotante tiene "Marqué que se
   envió" como respaldo manual.

## Cómo funciona

- La web detecta la extensión vía pings de `window.postMessage` (sin tocar
  el DOM, para no romper la hidratación de React) y le pasa el aviso + CV.
- El content script de la web descarga el CV (con tu sesión, sin exponer
  URLs firmadas) y lo envía al service worker.
- El service worker abre el aviso original; el content script del portal
  adjunta el PDF al `input[type=file]` y vigila la confirmación.
- La confirmación vuelve a las pestañas abiertas de EmpleosAR, que
  marcan el aviso como Aplicado.

## Límites

- LinkedIn puede bloquear formularios Easy Apply a bots; si no detecta el
  envío, usá el botón de respaldo.
- El CV queda en `chrome.storage.session` (se borra al cerrar el navegador).