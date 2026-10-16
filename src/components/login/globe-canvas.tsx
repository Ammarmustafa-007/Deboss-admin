"use client";

import { useEffect, useRef } from "react";

type Vec = [number, number, number];

const D = Math.PI / 180;
// Simplified continent outlines (lon, lat) used to scatter land dots.
const POLY: [number, number][][] = [[[-168, 66], [-130, 70], [-95, 72], [-65, 60], [-55, 48], [-75, 38], [-80, 26], [-97, 26], [-105, 20], [-92, 15], [-80, 8], [-100, 17], [-117, 32], [-125, 42], [-125, 50], [-140, 60]], [[-55, 60], [-20, 70], [-25, 82], [-60, 80]], [[-78, 8], [-60, 10], [-35, -6], [-40, -22], [-58, -38], [-68, -55], [-75, -45], [-71, -18], [-81, -5]], [[-10, 36], [-9, 43], [0, 50], [5, 58], [20, 70], [40, 68], [40, 45], [28, 41], [15, 38], [3, 37]], [[-17, 21], [-6, 36], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [33, -27], [20, -35], [12, -17], [9, 4], [-8, 4], [-17, 14]], [[40, 68], [100, 78], [170, 68], [140, 50], [122, 30], [110, 18], [104, 2], [98, 10], [78, 8], [72, 20], [57, 25], [44, 13], [35, 32], [28, 41], [40, 45]], [[114, -22], [130, -12], [142, -11], [153, -27], [146, -39], [135, -34], [115, -34]], [[-6, 50], [2, 52], [-3, 58]], [[95, 5], [105, -6], [120, -9], [140, -8], [130, 0], [105, 5]]];
const CITIES: Record<string, [number, number]> = { Dallas: [-96.8, 32.8], Atlanta: [-84.4, 33.7], Miami: [-80.2, 25.8], Chicago: [-87.6, 41.9], London: [-0.1, 51.5], Dubai: [55.3, 25.2], Lahore: [74.3, 31.5], Singapore: [103.8, 1.3], "São Paulo": [-46.6, -23.5], Lagos: [3.4, 6.5], Sydney: [151.2, -33.9] };
const LABELLED = ["Dallas", "London", "Lahore", "Dubai", "Singapore"];
const ROUTES = [["Dallas", "London"], ["Dallas", "São Paulo"], ["Dallas", "Lahore"], ["Lahore", "Dubai"], ["Dubai", "London"], ["Singapore", "Sydney"], ["Lahore", "Singapore"], ["Atlanta", "Lagos"], ["Chicago", "Miami"]];

const inPolygon = (lon: number, lat: number, polygon: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = polygon[i], [d, e] = polygon[j];
    if ((b > lat) !== (e > lat) && lon < ((d - a) * (lat - b)) / (e - b) + a) inside = !inside;
  }
  return inside;
};
const toVec = (lon: number, lat: number, height = 1): Vec => [height * Math.cos(lat * D) * Math.sin(lon * D), height * Math.sin(lat * D), height * Math.cos(lat * D) * Math.cos(lon * D)];

function buildLand(): Vec[] {
  const points: Vec[] = [];
  for (let lat = -60; lat <= 80; lat += 2.4) {
    const step = 2.4 / Math.max(0.2, Math.cos(lat * D));
    for (let lon = -180; lon < 180; lon += step) if (POLY.some((polygon) => inPolygon(lon, lat, polygon))) points.push(toVec(lon, lat));
  }
  return points;
}

function buildArcs(): Vec[][] {
  return ROUTES.map(([from, to]) => {
    const A = toVec(...CITIES[from]), B = toVec(...CITIES[to]);
    const w = Math.acos(A[0] * B[0] + A[1] * B[1] + A[2] * B[2]), s = Math.sin(w), path: Vec[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s, h = 1 + 0.22 * Math.sin(Math.PI * t) * Math.min(1, w);
      path.push([(k1 * A[0] + k2 * B[0]) * h, (k1 * A[1] + k2 * B[1]) * h, (k1 * A[2] + k2 * B[2]) * h]);
    }
    return path;
  });
}

/** Rotating dotted globe with animated freight lanes, ported from the DEBOSS login prototype. */
export function GlobeCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const land = buildLand();
    const arcs = buildArcs();
    let W = 0, H = 0, R = 0, cx0 = 0, cy = 0, cx = 0, rot = 1.4, mx = 0.5, my = 0.5, frame = 0;

    const project = ([x, y, z]: Vec): Vec => {
      const x1 = x * Math.cos(rot) + z * Math.sin(rot), z1 = -x * Math.sin(rot) + z * Math.cos(rot), tilt = 0.38 + (my - 0.5) * 0.12;
      const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
      return [cx + R * x1, cy - R * y2, z2];
    };

    const draw = (ts: number) => {
      cx = cx0 - (mx - 0.5) * 26;
      g.clearRect(0, 0, W, H);
      const halo = g.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.28);
      halo.addColorStop(0, "#f7941d77"); halo.addColorStop(0.4, "#7c5cfc22"); halo.addColorStop(1, "#f7941d00");
      g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.28, 0, 7); g.fill();
      const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, "#26211a"); body.addColorStop(1, "#0a0908");
      g.fillStyle = body; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();

      g.lineWidth = 1; g.strokeStyle = "#ffffff12";
      for (let lon = -180; lon < 180; lon += 30) { g.beginPath(); let on = false; for (let lat = -90; lat <= 90; lat += 6) { const p = project(toVec(lon, lat)); if (p[2] > 0) { if (on) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); on = true; } else on = false; } g.stroke(); }
      for (let lat = -60; lat <= 60; lat += 30) { g.beginPath(); let on = false; for (let lon = -180; lon <= 180; lon += 6) { const p = project(toVec(lon, lat)); if (p[2] > 0) { if (on) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); on = true; } else on = false; } g.stroke(); }

      g.fillStyle = "#ffe6c4";
      for (const v of land) { const p = project(v); if (p[2] <= 0) continue; const fade = 0.4 + 0.6 * Math.min(1, Math.max(0, (p[0] / W - 0.2) / 0.4)); g.globalAlpha = (0.12 + 0.6 * p[2]) * fade; g.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
      g.globalAlpha = 1;

      arcs.forEach((path, i) => {
        const head = ((ts / 1000) * 0.16 + i * 0.13) % 1, colour = i % 2 ? "15,181,166" : "247,148,29";
        for (let k = 1; k < path.length; k++) {
          const a = project(path[k - 1]), b = project(path[k]);
          if (a[2] < -0.02 || b[2] < -0.02) continue;
          const d = (head - k / 40 + 1) % 1, trail = d < 0.3 ? 1 - d / 0.3 : 0;
          g.strokeStyle = `rgba(${colour},${0.2 + 0.8 * trail})`; g.lineWidth = 1 + 2.2 * trail; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        }
        const h = project(path[Math.round(head * 40)]);
        if (h[2] > 0) { g.fillStyle = "#fff"; g.shadowColor = "#F7941D"; g.shadowBlur = 14; g.beginPath(); g.arc(h[0], h[1], 2.6, 0, 7); g.fill(); g.shadowBlur = 0; }
      });

      let n = 0;
      for (const name in CITIES) {
        const p = project(toVec(...CITIES[name])); n++;
        if (p[2] < 0.05) continue;
        const q = (ts / 45 + n * 9) % 26;
        g.strokeStyle = `rgba(247,148,29,${0.7 * (1 - q / 26)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 3 + q * 0.6, 0, 7); g.stroke();
        g.fillStyle = "#F7941D"; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill();
        if (LABELLED.includes(name) && p[2] > 0.25) { g.fillStyle = "#ffffffaa"; g.font = "500 11px Poppins, sans-serif"; g.fillText(name, p[0] + 9, p[1] + 4); }
      }
    };

    const size = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * ratio; canvas.height = H * ratio;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      const wide = W > 960;
      R = wide ? Math.min(H * 0.52, W * 0.34) : W * 0.55;
      cx0 = W * (wide ? 0.58 : 0.5); cy = H * (wide ? 0.56 : 0.28);
      if (reduced) draw(0);
    };
    const onPointer = (event: PointerEvent) => { mx = event.clientX / window.innerWidth; my = event.clientY / window.innerHeight; };
    const loop = (ts: number) => { rot -= 0.0013; draw(ts); frame = requestAnimationFrame(loop); };

    size();
    window.addEventListener("resize", size);
    window.addEventListener("pointermove", onPointer);
    if (!reduced) frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none fixed inset-0 z-0 h-full w-full ${className ?? ""}`} />;
}
