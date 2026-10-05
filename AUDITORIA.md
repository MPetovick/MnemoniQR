# MnemoniQR · Auditoría de seguridad y privacidad (v2.1 → v3.0)

Fecha: 5 de octubre de 2026. Alcance: `index.html`, `script.js`, `styles.css`, `sw.js`, `manifest.json`.

## Hallazgos críticos

**C1. La lista BIP39 estaba corrupta.** Faltaba `prepare` y `private` aparecía dos veces. Desde el índice 1359 las palabras tenían el número equivocado: cualquier semilla con `prepare` se rechazaba, y las que contenían palabras entre `prepare` y `prison` fallaban el checksum aunque fueran correctas. En v3 se usa la lista canónica y la app comprueba su SHA-256 al arrancar; si no coincide, bloquea el cifrado.

**C2. Fuga del backup a Google.** Si la librería de QR no cargaba (la URL `qrcode@1.5.1/build/qrcode.min.js` del CDN probablemente no existe), el código enviaba el texto cifrado completo a `chart.googleapis.com` dentro de la URL. Ese servicio está retirado y, además, la URL quedaba en registros de terceros. Eliminado.

**C3. Nota y fecha en claro dentro del QR.** La "nota" y la fecha de creación iban en los 128 bytes de metadatos, que se usaban como datos autenticados pero sin cifrar. Cualquiera que escaneara el QR podía leer "Cartera principal" y cuándo se creó. En v3 todo va dentro del cifrado, con relleno a bloques de 64 bytes para que tampoco se deduzca el número de palabras.

**C4. Contraseña guardada en memoria 5 minutos.** La caché de claves usaba como índice la cadena `contraseña:salt` en claro. Eliminada; las claves AES se importan como no extraíbles y los buffers intermedios se ponen a cero.

## Hallazgos altos

**A1. Dependencias de terceros en una app "offline".** Font Awesome (Cloudflare), qrcode, jsPDF y jsQR (jsDelivr) y el script de Telegram, que no se usaba. Cada carga revelaba la IP y el uso de la app a esos servicios, y sin SRI un CDN comprometido podía sustituir el código y robar semillas. En v3 todo está en `vendor/`, los iconos son SVG locales y jsPDF se sustituye por un generador de PDF vectorial propio (unas 80 líneas).

**A2. La CSP rompía la propia app.** `script-src` no permitía `'unsafe-inline'`, así que el bloque `<script>` del registro del service worker y los `onerror` nunca se ejecutaban. Además permitía `img-src https:` y `connect-src telegram.org`, rutas de exfiltración. La nueva CSP es `default-src 'none'` con solo lo propio y `'wasm-unsafe-eval'` para Argon2.

**A3. KDF débil frente a GPU.** PBKDF2-SHA256 con 310 000 iteraciones no usa memoria y se paraleliza bien en GPU. v3 usa Argon2id (64 MiB, 3 pasadas). Si el navegador bloquea WebAssembly (p. ej. modo bloqueo de iOS), cae a PBKDF2 con 600 000 iteraciones y lo indica.

**A4. Sin confirmación de contraseña.** Un error al teclearla hacía el backup irrecuperable. Ahora hay campo de repetición y un botón "Comprobar que puedo recuperarlo" que relee el QR desde los píxeles y pide la contraseña de memoria sin mostrar la semilla.

**A5. El service worker nunca llegaba a instalarse.** `cache.addAll` falla entero si un fichero no existe, y faltaban `assets/offline.html`, `assets/apple-touch-icon.png`, `favicon.ico` y el logo `.png` (el proyecto tiene `.webp`). Resultado: la app no funcionaba sin conexión. También cacheaba cualquier respuesta de red y tenía manejadores de push y background sync innecesarios. Reescrito: solo precarga ficheros propios, no cachea nada nuevo y no toca peticiones externas.

**A6. Inyección HTML.** Toasts, sugerencias y la cuadrícula de palabras se construían con `innerHTML` a partir de mensajes de error y del contenido descifrado. Ahora todo usa `textContent`.

## Hallazgos medios

- La detección de "contraseña incorrecta" buscaba textos que WebCrypto nunca devuelve (`bad decrypt`); se mostraba un error técnico. Ahora se detecta `OperationError`.
- El "bloqueo de 30 s" tras 5 intentos solo mostraba un mensaje: se podía seguir probando. v3 aplica un retardo creciente real, aunque se documenta que no protege frente a ataques offline (la protección real es la contraseña + Argon2id).
- El temporizador de 60 s se pausaba al cambiar de app, dejando la semilla en pantalla indefinidamente. Ahora se borra al pasar a segundo plano y una capa cubre la vista previa del multitarea.
- El generador de contraseñas tenía sesgo de módulo (`byte % 72`). Ahora usa un alfabeto de 64 símbolos sin sesgo: 20 caracteres, 120 bits.
- El medidor de fuerza solo contaba tipos de carácter (`Password1!` salía "fuerte"). Ahora estima bits y penaliza patrones comunes. Sigue siendo heurístico.
- IV de 16 bytes en AES-GCM: funciona, pero lo estándar es 12. Corregido en v3.
- No se normalizaba la entrada (mayúsculas, NFKD). Ahora sí, se aceptan 15 y 21 palabras y se autocompletan prefijos de 4 letras, como define BIP39.
- `Permissions-Policy` en `<meta>` no tiene efecto y, si lo tuviera, `camera=()` bloquearía el escáner. Movido a cabeceras HTTP con `camera=(self)`.
- `maximum-scale=1.0` impedía el zoom (accesibilidad).
- Varias referencias a elementos inexistentes (`qr-metadata`, `decrypted-metadata`, `scanner-status-text`) hacían que la nota descifrada nunca se mostrara.
- Mezcla de inglés y español en la interfaz.

## Mejoras añadidas

- Formato `MQR3`: 163 caracteres frente a unos 520 de v2. QR más pequeño y fácil de leer; se guarda la entropía (16–32 bytes) en lugar de las palabras.
- Compatibilidad de lectura con backups `MQRv2`, con aviso para recifrarlos.
- Indicador de conexión que recomienda el modo avión.
- Texto oculto mientras se escribe la semilla, atributos para desactivar autocorrección y extensiones como Grammarly.
- Semilla descifrada desenfocada hasta que se toca.
- Avisos antes de copiar (portapapeles vaciado a los 30 s) y antes de compartir.
- PDF con QR vectorial, instrucciones de recuperación y el texto cifrado impreso como respaldo si el QR se daña.
- PNG en 1024 px para imprimir.
- Lectura con `BarcodeDetector` nativo cuando existe y varias escalas en imágenes subidas.
- Límites a los parámetros de Argon2 leídos del QR, para que un QR malicioso no bloquee el dispositivo.
- Iconos de la PWA generados (incluidos `maskable`) y manifest corregido.
- `_headers` (Netlify / Cloudflare Pages) y `vercel.json` con CSP, HSTS, `frame-ancestors`, COOP y CORP.

## Límites que conviene conocer

- JavaScript no permite borrar cadenas de memoria; el navegador puede conservar copias de la semilla hasta que se cierra la pestaña.
- Quien tenga el QR puede probar contraseñas sin límite. La seguridad depende de que la contraseña sea larga y única.
- Teclados de terceros pueden registrar lo que se escribe. Lo más seguro es un dispositivo dedicado, en modo avión.

## Siguientes pasos recomendados

- Dividir la semilla en varios QR con Shamir (SLIP-39 o 2 de 3) para no depender de un solo papel.
- Soporte de passphrase BIP39 (la "palabra 25") como dato aparte.
- Firmar las versiones publicadas y mostrar el hash de `script.js` para que se pueda verificar la copia instalada.
- Pruebas automáticas con los vectores oficiales de BIP39.
