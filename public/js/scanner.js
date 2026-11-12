/* global window, jsQR, GuestSupport */
/**
 * QR scanning.
 *
 * Station signs encode /{venue}/{slug}. Amenity markers encode /s/CODE.
 * Phone-camera navigation hits those URLs directly; this in-app scanner is the
 * faster path for guests already playing.
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
  let openGeneration = 0;
  let opening = false;
  let hintKey = 'Point your camera at a code on the trail';

  function say(message) {
    return window.Lang ? Lang.t(message) : message;
  }

  function setHint(key) {
    hintKey = key;
    if (el.hint) el.hint.textContent = say(key);
  }

  function parsePayload(raw) {
    if (window.GuestSupport?.parseScanPayload) {
      return window.GuestSupport.parseScanPayload(raw);
    }
    const text = String(raw || '').trim();
    const match = text.match(/\/s\/([A-Za-z0-9-]+)/i);
    if (match) return { kind: 'amenity', code: match[1].toUpperCase() };
    if (/^[A-Za-z0-9-]{4,14}$/.test(text)) return { kind: 'amenity', code: text.toUpperCase() };
    return { kind: 'invalid' };
  }

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

  function stopStream(active) {
    if (active) {
      try { active.getTracks().forEach((track) => track.stop()); } catch { /* already ended */ }
    }
  }

  function clearVideo() {
    if (el.video) el.video.srcObject = null;
  }

  async function open(handler) {
    if (opening || isOpen()) {
      // Overlapping open: keep the existing attempt, just refresh the handler.
      onCode = handler || onCode;
      return;
    }

    const generation = ++openGeneration;
    opening = true;
    onCode = handler || onCode;
    el.root.hidden = false;
    el.root.setAttribute('aria-modal', 'true');
    el.root.setAttribute('role', 'dialog');
    requestAnimationFrame(() => {
      if (generation === openGeneration) el.root.classList.add('is-open');
    });
    el.input.value = '';
    el.close?.focus();

    if (!navigator.mediaDevices?.getUserMedia) {
      if (generation === openGeneration) {
        setHint('This browser can’t open the camera. Type the code printed under the sign instead.');
        el.input.focus();
      }
      opening = false;
      return;
    }

    let localStream = null;
    try {
      const jsqr = await loadLibrary();
      if (generation !== openGeneration) return;

      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (generation !== openGeneration) {
        stopStream(localStream);
        return;
      }

      stream = localStream;
      el.video.srcObject = stream;
      await el.video.play();
      if (generation !== openGeneration) {
        stopTracks();
        return;
      }
      setHint('Point your camera at a station or map code');
      decoding = true;
      tick(jsqr, generation);
    } catch (err) {
      stopStream(localStream);
      if (generation !== openGeneration) return;
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setHint(denied
        ? 'Camera access is off. Turn it on in your browser settings, or type the code below.'
        : 'Camera isn’t available right now. Type the code printed under the sign instead.');
      el.input.focus();
    } finally {
      if (generation === openGeneration) opening = false;
    }
  }

  function tick(jsqr, generation) {
    if (!decoding || generation !== openGeneration) return;
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
          const payload = parsePayload(found.data);
          const key = payload.kind === 'station'
            ? `station:${payload.venue}/${payload.slug}`
            : payload.kind === 'amenity'
              ? `amenity:${payload.code}`
              : null;
          const now = Date.now();
          // Guard against the same sign firing over and over while framed.
          if (key && (key !== lastCode || now - lastCodeAt > 2500)) {
            lastCode = key;
            lastCodeAt = now;
            buzz();
            onCode(payload);
          }
        }
      } catch {
        /* a dropped frame is not worth interrupting the loop for */
      }
    }
    rafId = requestAnimationFrame(() => tick(jsqr, generation));
  }

  function buzz() {
    if (navigator.vibrate) navigator.vibrate(35);
  }

  function stopTracks() {
    decoding = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    stopStream(stream);
    stream = null;
    clearVideo();
  }

  function close() {
    openGeneration += 1;
    opening = false;
    stopTracks();
    el.root.classList.remove('is-open');
    setTimeout(() => {
      if (!el.root.classList.contains('is-open')) el.root.hidden = true;
    }, 260);
  }

  const isOpen = () => !el.root.hidden && el.root.classList.contains('is-open')
    || (!el.root.hidden && opening);

  function submitManual() {
    const payload = parsePayload(el.input.value);
    if (payload.kind === 'invalid') {
      setHint('That code doesn’t look right. Use a station link or the letters under the sign.');
      return;
    }
    el.input.value = '';
    onCode(payload);
  }

  el.close?.addEventListener('click', close);
  el.submit?.addEventListener('click', submitManual);
  el.input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitManual();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (opening || decoding || stream)) close();
  });
  window.addEventListener('pagehide', () => {
    if (opening || decoding || stream) close();
  });

  return {
    open, close, isOpen, buzz, parsePayload,
    syncHint() { if (el.hint) el.hint.textContent = say(hintKey); },
  };
})();

window.Scanner = Scanner;
