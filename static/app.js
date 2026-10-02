import * as THREE from "three";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function fmtBytes(n) {
  if (!n && n !== 0) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}
function fmtSpeed(n) { return n ? `${fmtBytes(n)}/s` : ""; }
function fmtEta(s) {
  if (!s && s !== 0) return "";
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
function fmtDur(s) {
  if (!s) return "";
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Three.js: a quiet drifting point cloud sphere behind the hero ----------
(function initGL() {
  const canvas = document.getElementById("gl");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Fibonacci sphere of points
  const COUNT = 900;
  const positions = new Float32Array(COUNT * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * r;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.012,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geom, mat);
  points.scale.setScalar(2.2);
  scene.add(points);

  // soft accent light-point in the middle (just a visual anchor)
  const centerGeom = new THREE.BufferGeometry();
  centerGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  const centerMat = new THREE.PointsMaterial({
    color: 0x86efac, size: 0.08, transparent: true, opacity: 0.7, depthWrite: false,
  });
  scene.add(new THREE.Points(centerGeom, centerMat));

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.6;
  }, { passive: true });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });

  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    current.x += (target.x - current.x) * 0.04;
    current.y += (target.y - current.y) * 0.04;
    points.rotation.y += 0.0012;
    points.rotation.x = current.y * 0.5;
    points.rotation.z = current.x * -0.2;
    renderer.render(scene, camera);
  }
  loop();
})();

// ---------- custom select (progressively enhances <select>) ----------
function enhanceSelect(sel) {
  const wrap = document.createElement("div");
  wrap.className = "select";
  wrap.dataset.open = "false";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  const label = document.createElement("span");
  label.className = "select-label";
  const caret = document.createElement("span");
  caret.className = "select-caret";
  caret.setAttribute("aria-hidden", "true");
  caret.innerHTML = `<svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  trigger.append(label, caret);

  const menu = document.createElement("div");
  menu.className = "select-menu";
  menu.setAttribute("role", "listbox");

  const opts = Array.from(sel.options).map((o) => {
    const el = document.createElement("div");
    el.className = "select-opt";
    el.setAttribute("role", "option");
    el.dataset.value = o.value;
    el.textContent = o.textContent;
    menu.appendChild(el);
    return el;
  });

  function sync() {
    const current = opts.find((o) => o.dataset.value === sel.value) || opts[0];
    label.textContent = current ? current.textContent : "";
    opts.forEach((o) => {
      o.dataset.selected = String(o.dataset.value === sel.value);
      o.dataset.active = "false";
    });
  }

  function open() {
    wrap.dataset.open = "true";
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKey);
  }
  function close() {
    wrap.dataset.open = "false";
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey);
  }
  function onDocClick(e) { if (!wrap.contains(e.target)) close(); }
  function onKey(e) {
    if (e.key === "Escape") { close(); trigger.focus(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = opts.findIndex((o) => o.dataset.active === "true");
      const next = e.key === "ArrowDown"
        ? (i < 0 ? 0 : Math.min(opts.length - 1, i + 1))
        : (i < 0 ? opts.length - 1 : Math.max(0, i - 1));
      opts.forEach((o, j) => (o.dataset.active = String(j === next)));
      opts[next].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const act = opts.find((o) => o.dataset.active === "true");
      if (act) { sel.value = act.dataset.value; sel.dispatchEvent(new Event("change", { bubbles: true })); sync(); close(); }
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.dataset.open === "true" ? close() : open();
  });
  opts.forEach((o) => {
    o.addEventListener("click", () => {
      sel.value = o.dataset.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      close();
    });
  });

  wrap.append(trigger, menu);
  sel.parentNode.insertBefore(wrap, sel);
  sync();
  // keep select in DOM but hidden (CSS handles it) so app logic can still read .value
}

document.querySelectorAll("select").forEach(enhanceSelect);

// ---------- form wiring ----------
function readUrls() {
  return $("#urls").value.split("\n").map((s) => s.trim()).filter(Boolean);
}

function updateMode() {
  const audio = document.querySelector('input[name="mode"]:checked').value === "audio";
  $("#audio-opts").classList.toggle("hidden", !audio);
  $("#video-opts").classList.toggle("hidden", audio);
}
$$('input[name="mode"]').forEach((r) => r.addEventListener("change", updateMode));
updateMode();

// ---------- inspect ----------
const probeBtn = $("#probe-btn");
const probeStatus = $("#probe-status");
const probeResult = $("#probe-result");
const previewEl = $("#preview");

function entryHTML(e) {
  const thumb = e.thumbnail
    ? `<img src="${esc(e.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<div class="thumb-ph">no preview</div>`;
  const sub = [esc(e.uploader || ""), e.duration ? fmtDur(e.duration) : ""].filter(Boolean).join(" · ");
  return `${thumb}<div class="meta"><div class="title">${esc(e.title || "(untitled)")}</div><div class="sub2">${sub}</div></div>`;
}

probeBtn.addEventListener("click", async () => {
  const list = readUrls();
  if (!list.length) {
    probeStatus.textContent = "Paste a URL first.";
    probeStatus.classList.add("err");
    return;
  }
  probeStatus.classList.remove("err");
  probeBtn.disabled = true;
  probeStatus.textContent = `Inspecting ${list.length} link${list.length > 1 ? "s" : ""}…`;
  previewEl.innerHTML = "";
  probeResult.classList.add("hidden");

  try {
    for (const u of list) {
      let r, data;
      try {
        r = await fetch("/api/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u }),
        });
        data = await r.json();
      } catch (netErr) {
        const err = document.createElement("div");
        err.className = "err";
        err.textContent = `${u} — ${netErr.message}`;
        previewEl.appendChild(err);
        continue;
      }
      if (!r.ok) {
        const err = document.createElement("div");
        err.className = "err";
        err.textContent = `${u} — ${data.error || "failed"}`;
        previewEl.appendChild(err);
        continue;
      }
      if (data.type === "playlist") {
        const h = document.createElement("div");
        h.className = "playlist-head";
        h.innerHTML = `Playlist — <em>${esc(data.title || "")}</em> · ${(data.entries || []).length} items`;
        previewEl.appendChild(h);
        (data.entries || []).forEach((e) => {
          const div = document.createElement("div");
          div.className = "entry";
          div.innerHTML = entryHTML(e);
          previewEl.appendChild(div);
        });
      } else {
        const div = document.createElement("div");
        div.className = "entry";
        div.innerHTML = entryHTML(data);
        previewEl.appendChild(div);
      }
    }
    probeResult.classList.remove("hidden");
    probeStatus.textContent = "Ready.";
    probeResult.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    probeStatus.classList.add("err");
    probeStatus.textContent = "Error: " + e.message;
  } finally {
    probeBtn.disabled = false;
  }
});

// ---------- download + SSE ----------
const dlBtn = $("#download-btn");
const progressSection = $("#progress-section");
const progressList = $("#progress-list");
const doneList = $("#done-list");
const filesEl = $("#files");

const progressRows = new Map();
function rowFor(name) {
  if (progressRows.has(name)) return progressRows.get(name);
  const row = document.createElement("div");
  row.className = "progress-row";
  row.innerHTML = `
    <div class="name">${esc(name)}</div>
    <div class="stats"><span class="spd"></span><span class="eta"></span><span class="pct">0%</span></div>
    <div class="bar"><div></div></div>`;
  progressList.appendChild(row);
  progressRows.set(name, row);
  return row;
}

dlBtn.addEventListener("click", async () => {
  const list = readUrls();
  if (!list.length) {
    probeStatus.textContent = "Paste a URL first.";
    probeStatus.classList.add("err");
    return;
  }
  const audio = document.querySelector('input[name="mode"]:checked').value === "audio";
  const payload = {
    urls: list,
    audio_only: audio,
    audio_format: $("#audio-format").value,
    format: $("#quality").value,
  };

  dlBtn.disabled = true;
  progressList.innerHTML = "";
  progressRows.clear();
  filesEl.innerHTML = "";
  doneList.classList.add("hidden");
  progressSection.classList.remove("hidden");
  progressSection.scrollIntoView({ behavior: "smooth", block: "start" });

  let r, data;
  try {
    r = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    data = await r.json();
  } catch (netErr) {
    progressList.innerHTML = `<div class="err">${esc(netErr.message)}</div>`;
    dlBtn.disabled = false;
    return;
  }
  if (!r.ok) {
    progressList.innerHTML = `<div class="err">${esc(data.error || "failed")}</div>`;
    dlBtn.disabled = false;
    return;
  }

  const jobId = data.job_id;
  const es = new EventSource(`/api/events/${jobId}`);
  es.onmessage = (ev) => {
    let d;
    try { d = JSON.parse(ev.data); } catch { return; }
    if (d.type === "progress" && d.filename) {
      const row = rowFor(d.filename);
      const pct = d.percent != null ? d.percent : 0;
      row.querySelector(".bar > div").style.width = pct + "%";
      row.querySelector(".pct").textContent = pct.toFixed(0) + "%";
      row.querySelector(".spd").textContent = fmtSpeed(d.speed);
      row.querySelector(".eta").textContent = fmtEta(d.eta);
    } else if (d.type === "file_done" && d.filename) {
      const row = rowFor(d.filename);
      row.querySelector(".bar > div").style.width = "100%";
      row.querySelector(".pct").textContent = "100%";
      row.querySelector(".pct").classList.add("ok");
    } else if (d.type === "error") {
      const err = document.createElement("div");
      err.className = "err";
      err.textContent = d.message || "unknown error";
      progressList.appendChild(err);
    } else if (d.type === "done") {
      es.close();
      dlBtn.disabled = false;
      doneList.classList.remove("hidden");
      filesEl.innerHTML = "";
      (d.files || []).forEach((name) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `/files/${jobId}/${encodeURIComponent(name)}`;
        a.download = name;
        a.innerHTML = `<span class="fname">${esc(name)}</span><span class="fgrab">download ↓</span>`;
        li.appendChild(a);
        filesEl.appendChild(li);
      });
      doneList.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  es.onerror = () => {
    es.close();
    dlBtn.disabled = false;
  };
});
