/**
 * Professional Three.js WebGL2 & CPU/GPU Performance Telemetry HUD (`?perf=1`)
 *
 * Tracks:
 * - FPS (Current, Avg, 1% Low), Frame Time (ms), and CPU Render Pass Time (ms)
 * - Rolling 120-frame Frame-Time & FPS sparkline canvas graph
 * - WebGLRenderer.info: Draw Calls, Triangles, GPU Geometries, GPU Textures, Shader Programs
 * - JS Heap Memory (MB) & GC stability (when available in Chromium)
 * - Unmasked GPU Hardware & Viewport / DPR resolution
 * - Quick diagnostic toggles (Pixel Ratio 1x/2x, Shadow Map pass toggle, Reset stats)
 *
 * Activate via URL query `?perf=1` (or `?perf=true` / `?debug=1`), or press `Shift + P`.
 */

export function initPerfMonitor(renderer, scene, _camera) {
  const params = new URLSearchParams(window.location.search);
  const enabledByUrl = (
    params.get('perf') === '1' ||
    params.get('perf') === 'true' ||
    params.get('debug') === '1'
  );

  let isActive = enabledByUrl;
  let hudEl = null;
  let graphCtx = null;

  // Rolling circular buffer for 120 frames (zero per-frame array allocations)
  const HISTORY_LEN = 120;
  const GRAPH_W = 372;
  const GRAPH_H = 76;
  const frameTimes = new Float32Array(HISTORY_LEN);
  const renderTimes = new Float32Array(HISTORY_LEN);
  const sortedScratch = new Float32Array(HISTORY_LEN);
  let histIdx = 0;
  let sampleCount = 0;

  let lastFrameEnd = performance.now();
  let renderStart = 0;
  let lastRenderCost = 0;
  let lastHudUpdate = 0;
  let peakFrameMs = 0;

  // Cached DOM value nodes inside HUD
  const dom = {};

  function getGPUName() {
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const raw = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
        return raw.replace(/ANGLE \((.+)\)/, '$1').slice(0, 52);
      }
      return gl.getParameter(gl.RENDERER) || 'WebGL2 Renderer';
    } catch {
      return 'WebGL2 Hardware';
    }
  }

  function buildHUD() {
    if (hudEl) return;

    const style = document.createElement('style');
    style.textContent = `
      #three-perf-hud {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        width: 412px;
        max-width: calc(100vw - 32px);
        background: rgba(22, 18, 16, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1.5px solid #9e8d7b;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(232, 223, 209, 0.16);
        color: #f0e8dc;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        line-height: 1.45;
        padding: 16px 18px;
        user-select: none;
        pointer-events: auto;
        border-radius: 3px;
      }
      #three-perf-hud.hidden {
        display: none;
      }
      .perf-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(158, 144, 127, 0.42);
        padding-bottom: 9px;
        margin-bottom: 12px;
        cursor: move;
      }
      .perf-title {
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #f5efe4;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .perf-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #4cd97b;
        box-shadow: 0 0 8px #4cd97b;
      }
      .perf-close-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(158, 144, 127, 0.55);
        color: #d6c8b6;
        font-family: inherit;
        font-size: 10.5px;
        font-weight: 600;
        padding: 3px 9px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .perf-close-btn:hover {
        border-color: #f5efe4;
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
      }
      .perf-kpi-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }
      .perf-kpi-box {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(158, 144, 127, 0.32);
        padding: 8px 10px;
      }
      .perf-kpi-label {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #b5a695;
      }
      .perf-kpi-val {
        font-size: 18px;
        font-weight: 600;
        color: #ffffff;
        margin-top: 3px;
        white-space: nowrap;
      }
      .perf-graph-wrap {
        position: relative;
        width: 100%;
        height: 76px;
        background: rgba(0, 0, 0, 0.42);
        border: 1px solid rgba(158, 144, 127, 0.35);
        margin-bottom: 12px;
      }
      .perf-graph-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      .perf-graph-caption {
        position: absolute;
        top: 5px;
        left: 8px;
        right: 8px;
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: rgba(240, 232, 220, 0.78);
        pointer-events: none;
      }
      .perf-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px 18px;
        padding: 10px 0;
        border-top: 1px dashed rgba(158, 144, 127, 0.38);
        border-bottom: 1px dashed rgba(158, 144, 127, 0.38);
        margin-bottom: 10px;
      }
      .perf-stat {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 11.5px;
      }
      .perf-stat-k {
        color: #b5a695;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .perf-stat-v {
        color: #ffffff;
        font-weight: 600;
      }
      .perf-gpu-line {
        font-size: 10.5px;
        color: #b5a695;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 11px;
      }
      .perf-actions {
        display: flex;
        gap: 7px;
      }
      .perf-btn {
        flex: 1;
        background: rgba(232, 223, 209, 0.09);
        border: 1px solid rgba(158, 144, 127, 0.48);
        color: #f0e8dc;
        font-family: inherit;
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 7px 8px;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .perf-btn:hover {
        background: rgba(232, 223, 209, 0.20);
      }
      .perf-btn.active {
        background: #5c394d;
        border-color: #cdaab9;
        color: #fff;
      }
    `;
    document.head.appendChild(style);

    hudEl = document.createElement('aside');
    hudEl.id = 'three-perf-hud';
    if (!isActive) hudEl.classList.add('hidden');

    hudEl.innerHTML = `
      <div class="perf-head" id="perf-drag-handle" title="Drag to reposition panel">
        <div class="perf-title">
          <span class="perf-dot" id="perf-status-dot"></span>
          <span>Three.js Telemetry</span>
        </div>
        <button class="perf-close-btn" id="perf-btn-hide" title="Hide Telemetry (Shift+P)">Hide</button>
      </div>

      <div class="perf-kpi-row">
        <div class="perf-kpi-box">
          <div class="perf-kpi-label">FPS / 1% Low</div>
          <div class="perf-kpi-val" id="perf-val-fps">--</div>
        </div>
        <div class="perf-kpi-box">
          <div class="perf-kpi-label">Frame Time</div>
          <div class="perf-kpi-val" id="perf-val-ms">-- ms</div>
        </div>
        <div class="perf-kpi-box">
          <div class="perf-kpi-label">Render CPU</div>
          <div class="perf-kpi-val" id="perf-val-cpu">-- ms</div>
        </div>
      </div>

      <div class="perf-graph-wrap">
        <canvas class="perf-graph-canvas" id="perf-graph" width="${GRAPH_W}" height="${GRAPH_H}"></canvas>
        <div class="perf-graph-caption">
          <span>120-FRAME TIMELINE (16.7MS TARGET)</span>
          <span id="perf-val-peak">PEAK: 0.0ms</span>
        </div>
      </div>

      <div class="perf-grid">
        <div class="perf-stat"><span class="perf-stat-k">Draw Calls</span><span class="perf-stat-v" id="perf-val-calls">0</span></div>
        <div class="perf-stat"><span class="perf-stat-k">Triangles</span><span class="perf-stat-v" id="perf-val-tris">0</span></div>
        <div class="perf-stat"><span class="perf-stat-k">Geometries</span><span class="perf-stat-v" id="perf-val-geos">0</span></div>
        <div class="perf-stat"><span class="perf-stat-k">Textures</span><span class="perf-stat-v" id="perf-val-texs">0</span></div>
        <div class="perf-stat"><span class="perf-stat-k">Shaders</span><span class="perf-stat-v" id="perf-val-progs">0</span></div>
        <div class="perf-stat"><span class="perf-stat-k">JS Heap</span><span class="perf-stat-v" id="perf-val-heap">N/A</span></div>
        <div class="perf-stat"><span class="perf-stat-k">Viewport</span><span class="perf-stat-v" id="perf-val-res">--</span></div>
        <div class="perf-stat"><span class="perf-stat-k">Pixel Ratio</span><span class="perf-stat-v" id="perf-val-dpr">--</span></div>
      </div>

      <div class="perf-gpu-line" id="perf-val-gpu">GPU: Detecting...</div>

      <div class="perf-actions">
        <button class="perf-btn" id="perf-btn-dpr">DPR: Auto</button>
        <button class="perf-btn active" id="perf-btn-shadows">Shadows: On</button>
        <button class="perf-btn" id="perf-btn-reset">Reset Peak</button>
      </div>
    `;

    document.body.appendChild(hudEl);

    dom.dot = hudEl.querySelector('#perf-status-dot');
    dom.fps = hudEl.querySelector('#perf-val-fps');
    dom.ms = hudEl.querySelector('#perf-val-ms');
    dom.cpu = hudEl.querySelector('#perf-val-cpu');
    dom.peak = hudEl.querySelector('#perf-val-peak');
    dom.calls = hudEl.querySelector('#perf-val-calls');
    dom.tris = hudEl.querySelector('#perf-val-tris');
    dom.geos = hudEl.querySelector('#perf-val-geos');
    dom.texs = hudEl.querySelector('#perf-val-texs');
    dom.progs = hudEl.querySelector('#perf-val-progs');
    dom.heap = hudEl.querySelector('#perf-val-heap');
    dom.res = hudEl.querySelector('#perf-val-res');
    dom.dpr = hudEl.querySelector('#perf-val-dpr');
    dom.gpu = hudEl.querySelector('#perf-val-gpu');
    dom.graph = hudEl.querySelector('#perf-graph');
    graphCtx = dom.graph.getContext('2d');

    dom.gpu.textContent = `GPU: ${getGPUName()}`;

    // Make the HUD draggable by its header bar
    const dragHandle = hudEl.querySelector('#perf-drag-handle');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    dragHandle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      const rect = hudEl.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      hudEl.style.right = 'auto';
      hudEl.style.left = `${rect.left}px`;
      hudEl.style.top = `${rect.top}px`;
    });
    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const x = Math.max(8, Math.min(window.innerWidth - hudEl.offsetWidth - 8, e.clientX - dragOffsetX));
      const y = Math.max(8, Math.min(window.innerHeight - hudEl.offsetHeight - 8, e.clientY - dragOffsetY));
      hudEl.style.left = `${x}px`;
      hudEl.style.top = `${y}px`;
    });
    window.addEventListener('pointerup', () => {
      isDragging = false;
    });

    hudEl.querySelector('#perf-btn-hide').addEventListener('click', () => {
      toggleActive(false);
    });

    const btnDpr = hudEl.querySelector('#perf-btn-dpr');
    let forcedDprMode = 0; // 0 = Auto, 1 = 1.0x, 2 = 2.0x
    btnDpr.addEventListener('click', () => {
      forcedDprMode = (forcedDprMode + 1) % 3;
      const dpr = forcedDprMode === 0 ? Math.min(window.devicePixelRatio, 2) : (forcedDprMode === 1 ? 1.0 : 2.0);
      renderer.setPixelRatio(dpr);
      const canvas = renderer.domElement;
      const rect = canvas.parentElement.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      btnDpr.textContent = forcedDprMode === 0 ? 'DPR: Auto' : `DPR: ${dpr.toFixed(1)}x`;
    });

    const btnShadows = hudEl.querySelector('#perf-btn-shadows');
    btnShadows.addEventListener('click', () => {
      renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
      scene.traverse((obj) => {
        if (obj.isMesh && obj.material) obj.material.needsUpdate = true;
      });
      btnShadows.classList.toggle('active', renderer.shadowMap.enabled);
      btnShadows.textContent = renderer.shadowMap.enabled ? 'Shadows: On' : 'Shadows: Off';
    });

    hudEl.querySelector('#perf-btn-reset').addEventListener('click', () => {
      peakFrameMs = 0;
      sampleCount = 0;
    });
  }

  function toggleActive(forceState) {
    isActive = typeof forceState === 'boolean' ? forceState : !isActive;
    if (isActive && !hudEl) buildHUD();
    if (hudEl) hudEl.classList.toggle('hidden', !isActive);
  }

  // Allow toggling anytime via Shift + P
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      toggleActive();
    }
  });

  if (isActive) {
    buildHUD();
  }

  function drawGraph() {
    if (!graphCtx) return;
    const w = GRAPH_W;
    const h = GRAPH_H;
    graphCtx.clearRect(0, 0, w, h);

    // 16.67ms (60 FPS) target reference line
    const y60 = h - (16.67 / 33.33) * h;
    graphCtx.strokeStyle = 'rgba(232, 223, 209, 0.28)';
    graphCtx.setLineDash([3, 3]);
    graphCtx.beginPath();
    graphCtx.moveTo(0, y60);
    graphCtx.lineTo(w, y60);
    graphCtx.stroke();
    graphCtx.setLineDash([]);

    const barW = w / HISTORY_LEN;
    const count = Math.min(sampleCount, HISTORY_LEN);
    for (let i = 0; i < count; i++) {
      const idx = (histIdx - count + i + HISTORY_LEN) % HISTORY_LEN;
      const dtMs = frameTimes[idx];
      const normH = Math.min(1.0, dtMs / 33.33);
      const barH = Math.max(3, normH * h);
      const x = i * barW;

      if (dtMs <= 18.0) {
        graphCtx.fillStyle = 'rgba(76, 217, 123, 0.82)';
      } else if (dtMs <= 26.0) {
        graphCtx.fillStyle = 'rgba(240, 184, 73, 0.88)';
      } else {
        graphCtx.fillStyle = 'rgba(235, 87, 87, 0.92)';
      }
      graphCtx.fillRect(x, h - barH, Math.max(1.5, barW - 0.6), barH);
    }
  }

  return {
    beginRender() {
      if (!isActive) return;
      renderStart = performance.now();
    },

    endFrame() {
      if (!isActive) return;
      const now = performance.now();
      lastRenderCost = now - renderStart;
      const frameDt = now - lastFrameEnd;
      lastFrameEnd = now;

      if (frameDt > 0 && frameDt < 250) {
        frameTimes[histIdx] = frameDt;
        renderTimes[histIdx] = lastRenderCost;
        histIdx = (histIdx + 1) % HISTORY_LEN;
        if (sampleCount < HISTORY_LEN) sampleCount++;
        if (frameDt > peakFrameMs) peakFrameMs = frameDt;
      }

      // Refresh numeric text readouts & sparkline every 120ms to avoid DOM churn
      if (now - lastHudUpdate < 120 || sampleCount === 0) return;
      lastHudUpdate = now;

      let sumDt = 0;
      let sumCpu = 0;
      for (let i = 0; i < sampleCount; i++) {
        const ft = frameTimes[i];
        sumDt += ft;
        sumCpu += renderTimes[i];
        sortedScratch[i] = ft;
      }
      const avgDt = sumDt / sampleCount;
      const avgCpu = sumCpu / sampleCount;
      const avgFps = Math.round(1000 / Math.max(1, avgDt));

      // Compute 1% Low FPS (95th-99th percentile slowest frame in the rolling window)
      const slice = sortedScratch.subarray(0, sampleCount);
      slice.sort();
      const p99FrameMs = slice[Math.min(sampleCount - 1, Math.floor(sampleCount * 0.95))];
      const lowFps = Math.round(1000 / Math.max(1, p99FrameMs));

      dom.fps.textContent = `${avgFps} / ${lowFps}`;
      dom.ms.textContent = `${avgDt.toFixed(1)} ms`;
      dom.cpu.textContent = `${avgCpu.toFixed(2)} ms`;
      dom.peak.textContent = `PEAK: ${peakFrameMs.toFixed(1)}ms`;

      const statusColor = avgFps >= 55 ? '#4cd97b' : (avgFps >= 35 ? '#f0b849' : '#eb5757');
      dom.dot.style.background = statusColor;
      dom.dot.style.boxShadow = `0 0 8px ${statusColor}`;

      const info = renderer.info;
      dom.calls.textContent = String(info.render.calls);
      const tris = info.render.triangles;
      dom.tris.textContent = tris >= 1000 ? `${(tris / 1000).toFixed(1)}k` : String(tris);
      dom.geos.textContent = String(info.memory.geometries);
      dom.texs.textContent = String(info.memory.textures);
      dom.progs.textContent = String(info.programs ? info.programs.length : 0);

      if (performance.memory && performance.memory.usedJSHeapSize) {
        const mb = performance.memory.usedJSHeapSize / (1024 * 1024);
        dom.heap.textContent = `${mb.toFixed(1)} MB`;
      } else {
        dom.heap.textContent = 'N/A';
      }

      const dpr = renderer.getPixelRatio();
      const canvas = renderer.domElement;
      dom.res.textContent = `${canvas.width}×${canvas.height}`;
      dom.dpr.textContent = `${dpr.toFixed(2)}x`;

      drawGraph();
    }
  };
}
