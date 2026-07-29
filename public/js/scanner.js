/* global window, jsQR */
/**
 * QR scanning.
 *
 * The physical signs encode a URL (/s/CODE), so a guest can always use their
 * phone's built-in camera app and land in the app with the scan applied. This
 * in-app scanner is the faster path for guests already playing — it keeps them
 * in the game loop instead of bouncing through the OS camera each time.
 *
 * jsQR is loaded lazily: no camera permission prompt and no 250KB download
 * until someone actually taps Scan.
 */
const Scanner = (() => {
  const el = {
    root: document.getElementById('scanner'),
    video: document.getElementById('scannerVideo'),
    canvas: document.getElementById('scannerCanvas'),
    hint: document.getElementById('scannerHint'),
    close: document.getElementById('scannerClose'),
    input: document.getElementById('manualCode'),
    submit: document.getElementById('manualSubmit'),
  };

  let stream = null;
  let rafId = null;
  let decoding = false;
  let libraryPromise = null;
  let onCode = () => {};
  let lastCode = null;
  let lastCodeAt = 0;

  function loadLibrary() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/jsqr.js';
      script.onload = () => resolve(window.jsQR);
      script.onerror = () => reject(new Error('scanner_unavailable'));
      document.head.appendChild(script);
    });
    return libraryPromise;
  }

  async function open(handler) {
    onCode = handler || onCode;
    el.root.hidden = false;
    requestAnimationFrame(() => el.root.classList.add('is-open'));
    el.input.value = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      el.hint.textContent = 'This browser can’t open the camera. Type the code printed under the sign instead.';
      el.input.focus();
      return;
    }

    try {
      const jsqr = await loadLibrary();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      el.video.srcObject = stream;
      await el.video.play();
      el.hint.textContent = 'Point your camera at a code on the trail';
      decoding = true;
      tick(jsqr);
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      el.hint.textContent = denied
        ? 'Camera access is off. Turn it on in your browser settings, or type the code below.'
        : 'Camera isn’t available right now. Type the code printed under the sign instead.';
    }
  }

  function tick(jsqr) {
    if (!decoding) return;
    const { video, canvas } = el;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // Downscale before decoding: plenty of detail for a QR code, and it keeps
      // the loop cheap enough not to drain a cold phone battery.
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, 1));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsqr(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (found?.data) {
          const code = normalize(found.data);
          const now = Date.now();
          // Guard against the same sign firing over and over while framed.
          if (code && (code !== lastCode || now - lastCodeAt > 2500)) {
            lastCode = code;
            lastCodeAt = now;
            buzz();
            onCode(code);
          }
        }
      } catch {
        /* a dropped frame is not worth interrupting the loop for */
      }
    }
    rafId = requestAnimationFrame(() => tick(jsqr));
  }

  function normalize(raw) {
    const text = String(raw).trim();
    const match = text.match(/\/s\/([A-Za-z0-9-]+)/i);
    if (match) return match[1].toUpperCase();
    if (/^[A-Za-z0-9-]{4,14}$/.test(text)) return text.toUpperCase();
    return null;
  }

  function buzz() {
    if (navigator.vibrate) navigator.vibrate(35);
  }

  function close() {
    decoding = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    el.video.srcObject = null;
    el.root.classList.remove('is-open');
    setTimeout(() => { el.root.hidden = true; }, 260);
  }

  const isOpen = () => !el.root.hidden;

  function submitManual() {
    const code = normalize(el.input.value);
    if (!code) {
      el.hint.textContent = 'That code doesn’t look right. Check the letters under the sign.';
      return;
    }
    el.input.value = '';
    onCode(code);
  }

  el.close.addEventListener('click', close);
  el.submit.addEventListener('click', submitManual);
  el.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitManual();
  });

  return { open, close, isOpen, buzz };
})();

window.Scanner = Scanner;
