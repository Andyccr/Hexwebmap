export function $(id) {
  return document.getElementById(id);
}

export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    },
    emit(type, payload) {
      for (const fn of map.get(type) || []) fn(payload);
    },
  };
}

const ESC = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);
}

export function holdRepeat(btn, fn) {
  let timer = 0;
  const start = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* older browsers */
    }
    fn();
    clearInterval(timer);
    timer = setInterval(fn, 170);
  };
  const stop = () => clearInterval(timer);
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("lostpointercapture", stop);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}
