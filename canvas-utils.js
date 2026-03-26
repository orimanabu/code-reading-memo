'use strict';

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
// HIGHLIGHT HELPERS
// ═══════════════════════════════════════════════════════
export const EXT_LANG = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  tsx: 'typescript',
  py: 'python', pyw: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  c: 'cpp', h: 'cpp',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hxx: 'cpp',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin', kts: 'kotlin',
  swift: 'swift',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  html: 'html', htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini',
  xml: 'xml',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql',
  r: 'r',
  lua: 'lua',
  php: 'php',
  pl: 'perl',
  ex: 'elixir', exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  scala: 'scala',
  dart: 'dart',
  makefile: 'makefile',
  dockerfile: 'dockerfile',
};

export function langFromPath(filePath) {
  if (!filePath) return null;
  const base = filePath.split('/').pop();
  // Files without extension, e.g. Dockerfile, Makefile
  const nameLower = base.toLowerCase();
  if (nameLower === 'dockerfile') return 'dockerfile';
  if (nameLower === 'makefile')   return 'makefile';
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : null;
  return ext ? (EXT_LANG[ext] ?? null) : null;
}

// Replace first occurrence of `rawText` in HTML string, only inside text nodes (outside tags)
export function injectAnchor(html, rawText, linkId) {
  const pat = rawText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re  = new RegExp(pat, 'g');
  // split on HTML tags
  const parts = html.split(/(<[^>]*>)/);
  return parts.map((p, i) => {
    if (i % 2 === 1) return p; // tag → pass through
    return p.replace(re, () =>
      `<span class="link-anchor" data-lid="${linkId}">${esc(rawText)}</span>`
    );
  }).join('');
}

// Split highlighted HTML into per-line strings, correctly handling spans that
// cross line boundaries (e.g. highlight.js wraps ")\n{" inside one <span>).
// At each \n we close all currently-open spans and reopen them on the next line.
export function splitHtmlLines(html) {
  const lines = [];
  let cur = '';
  const openTags = []; // stack of opening tag strings, e.g. '<span class="hljs-function">'
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) { cur += html.slice(i); break; }
      const tag = html.slice(i, end + 1);
      i = end + 1;
      cur += tag;
      if (tag.startsWith('</')) {
        openTags.pop();
      } else {
        openTags.push(tag);
      }
    } else if (html[i] === '\n') {
      // Close all open spans, emit this line, then reopen them for the next line
      lines.push(cur + '</span>'.repeat(openTags.length));
      cur = openTags.join('');
      i++;
    } else {
      cur += html[i];
      i++;
    }
  }
  lines.push(cur);
  return lines;
}

// Wrap highlighted HTML lines with line-number spans
export function addLineNumbers(html, start) {
  const lines = splitHtmlLines(html);
  // Trim trailing empty line if code ends with \n
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((lineHtml, i) =>
    `<span class="code-line"><span class="ln-num" data-li="${i}">${start + i}</span>${lineHtml}</span>`
  ).join('');
}

// ═══════════════════════════════════════════════════════
// GEOMETRY
// ═══════════════════════════════════════════════════════

// Compute the point where a ray from (ocx, ocy) toward (tipX, tipY) first
// intersects the rounded-rect boundary defined by corners bl/br with radius r.
// Returns { x, y, tx, ty } (hit point + tangent direction) or null.
export function roundedRectRayHit(ocx, ocy, tipX, tipY, bl, br, r) {
  const left = bl.x, right = br.x, top = bl.y, bottom = br.y;
  const dx = tipX - ocx, dy = tipY - ocy;
  let bestT = Infinity, bestX, bestY, bestTx, bestTy;

  function tryT(t, px, py, tx, ty) {
    if (t > 1e-9 && t < bestT) { bestT = t; bestX = px; bestY = py; bestTx = tx; bestTy = ty; }
  }

  // Four straight edges (only the non-corner segments)
  if (Math.abs(dx) > 1e-9) {
    const tl = (left  - ocx) / dx;
    if (tl > 1e-9) { const py = ocy + tl * dy; if (py >= top + r && py <= bottom - r) tryT(tl, left,  py, 0, 1); }
    const tr = (right - ocx) / dx;
    if (tr > 1e-9) { const py = ocy + tr * dy; if (py >= top + r && py <= bottom - r) tryT(tr, right, py, 0, 1); }
  }
  if (Math.abs(dy) > 1e-9) {
    const tt = (top    - ocy) / dy;
    if (tt > 1e-9) { const px = ocx + tt * dx; if (px >= left + r && px <= right - r) tryT(tt, px, top,    1, 0); }
    const tb = (bottom - ocy) / dy;
    if (tb > 1e-9) { const px = ocx + tb * dx; if (px >= left + r && px <= right - r) tryT(tb, px, bottom, 1, 0); }
  }

  // Four corner arcs — each constrained to its quadrant
  const arcs = [
    { cx: left  + r, cy: top    + r, xMin: left,    xMax: left  + r, yMin: top,      yMax: top    + r },
    { cx: right - r, cy: top    + r, xMin: right- r, xMax: right,    yMin: top,      yMax: top    + r },
    { cx: left  + r, cy: bottom - r, xMin: left,    xMax: left  + r, yMin: bottom- r, yMax: bottom    },
    { cx: right - r, cy: bottom - r, xMin: right- r, xMax: right,    yMin: bottom- r, yMax: bottom    },
  ];
  for (const arc of arcs) {
    const fx = ocx - arc.cx, fy = ocy - arc.cy;
    const a  = dx * dx + dy * dy;
    const b  = 2 * (fx * dx + fy * dy);
    const c  = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    for (const sign of [1, -1]) {
      const t = (-b + sign * sq) / (2 * a);
      if (t <= 1e-9 || t >= bestT) continue;
      const px = ocx + t * dx, py = ocy + t * dy;
      if (px < arc.xMin || px > arc.xMax || py < arc.yMin || py > arc.yMax) continue;
      // Tangent = radius vector rotated 90° CCW
      const rx = px - arc.cx, ry = py - arc.cy;
      tryT(t, px, py, -ry / r, rx / r);
    }
  }

  return bestT < Infinity ? { x: bestX, y: bestY, tx: bestTx, ty: bestTy } : null;
}

// Compute the exit point on the edge of `from` node in the direction of `to` node.
// Both nodes are plain objects with { x, y, w, h } in canvas coordinates.
export function edgePoint(from, to) {
  const fcx = from.x + from.w / 2, fcy = from.y + from.h / 2;
  const tcx = to.x + to.w / 2,   tcy = to.y + to.h / 2;
  const dx = tcx - fcx, dy = tcy - fcy;
  const hw = from.w / 2, hh = from.h / 2;
  if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
    const x = fcx + (dx > 0 ? hw : -hw);
    const y = fcy + dy / (Math.abs(dx) || 1) * hw;
    return { x, y };
  } else {
    const y = fcy + (dy > 0 ? hh : -hh);
    const x = fcx + dx / (Math.abs(dy) || 1) * hh;
    return { x, y };
  }
}
