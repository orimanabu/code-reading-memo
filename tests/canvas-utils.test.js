import { describe, it, expect } from 'vitest';
import {
  esc,
  EXT_LANG,
  langFromPath,
  injectAnchor,
  splitHtmlLines,
  addLineNumbers,
  edgePoint,
  roundedRectRayHit,
} from '../canvas-utils.js';

// ─── esc ───────────────────────────────────────────────
describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<>&"')).toBe('&lt;&gt;&amp;&quot;');
  });

  it('leaves plain text unchanged', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  it('coerces non-strings to string', () => {
    expect(esc(42)).toBe('42');
    expect(esc(null)).toBe('null');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });
});

// ─── langFromPath ──────────────────────────────────────
describe('langFromPath', () => {
  it('returns null for empty/null/undefined input', () => {
    expect(langFromPath('')).toBeNull();
    expect(langFromPath(null)).toBeNull();
    expect(langFromPath(undefined)).toBeNull();
  });

  it('maps common extensions to language names', () => {
    expect(langFromPath('foo.js')).toBe('javascript');
    expect(langFromPath('foo.ts')).toBe('typescript');
    expect(langFromPath('foo.py')).toBe('python');
    expect(langFromPath('foo.go')).toBe('go');
    expect(langFromPath('foo.rs')).toBe('rust');
    expect(langFromPath('foo.java')).toBe('java');
    expect(langFromPath('foo.rb')).toBe('ruby');
    expect(langFromPath('foo.sh')).toBe('bash');
    expect(langFromPath('foo.json')).toBe('json');
    expect(langFromPath('foo.yaml')).toBe('yaml');
    expect(langFromPath('foo.yml')).toBe('yaml');
    expect(langFromPath('foo.md')).toBe('markdown');
    expect(langFromPath('foo.css')).toBe('css');
    expect(langFromPath('foo.html')).toBe('html');
  });

  it('handles paths with directories', () => {
    expect(langFromPath('src/components/App.tsx')).toBe('typescript');
    expect(langFromPath('/home/user/project/main.go')).toBe('go');
  });

  it('handles special filenames (case-insensitive)', () => {
    expect(langFromPath('Dockerfile')).toBe('dockerfile');
    expect(langFromPath('dockerfile')).toBe('dockerfile');
    expect(langFromPath('DOCKERFILE')).toBe('dockerfile');
    expect(langFromPath('Makefile')).toBe('makefile');
    expect(langFromPath('makefile')).toBe('makefile');
    expect(langFromPath('path/to/Dockerfile')).toBe('dockerfile');
  });

  it('returns null for unknown extension', () => {
    expect(langFromPath('foo.xyz')).toBeNull();
    expect(langFromPath('foo.unknown')).toBeNull();
  });

  it('returns null for file with no extension (not a special name)', () => {
    expect(langFromPath('somefile')).toBeNull();
  });
});

// ─── EXT_LANG ──────────────────────────────────────────
describe('EXT_LANG', () => {
  it('is a plain object mapping extensions to language names', () => {
    expect(typeof EXT_LANG).toBe('object');
    expect(EXT_LANG.js).toBe('javascript');
    expect(EXT_LANG.mjs).toBe('javascript');
    expect(EXT_LANG.ts).toBe('typescript');
    expect(EXT_LANG.c).toBe('cpp');
    expect(EXT_LANG.toml).toBe('ini');
  });
});

// ─── splitHtmlLines ────────────────────────────────────
describe('splitHtmlLines', () => {
  it('splits plain text on newlines', () => {
    expect(splitHtmlLines('line1\nline2\nline3')).toEqual(['line1', 'line2', 'line3']);
  });

  it('returns single-element array when no newline', () => {
    expect(splitHtmlLines('no newline')).toEqual(['no newline']);
  });

  it('handles empty string', () => {
    expect(splitHtmlLines('')).toEqual(['']);
  });

  it('closes and reopens spans that cross line boundaries', () => {
    const input = '<span class="hljs-keyword">a\nb</span>';
    const result = splitHtmlLines(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('<span class="hljs-keyword">a</span>');
    expect(result[1]).toBe('<span class="hljs-keyword">b</span>');
  });

  it('handles nested spans crossing lines', () => {
    const input = '<span class="a"><span class="b">x\ny</span></span>';
    const result = splitHtmlLines(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('<span class="a"><span class="b">x</span></span>');
    // Both spans are reopened on line 2, then closed by the original closing tags
    expect(result[1]).toBe('<span class="a"><span class="b">y</span></span>');
  });
});

// ─── addLineNumbers ────────────────────────────────────
describe('addLineNumbers', () => {
  it('wraps each line with code-line and ln-num spans', () => {
    const result = addLineNumbers('foo\nbar', 1);
    expect(result).toContain('<span class="ln-num" data-li="0">1</span>foo');
    expect(result).toContain('<span class="ln-num" data-li="1">2</span>bar');
  });

  it('respects custom start line number', () => {
    const result = addLineNumbers('x\ny', 10);
    expect(result).toContain('>10</span>x');
    expect(result).toContain('>11</span>y');
  });

  it('trims trailing empty line when code ends with newline', () => {
    const result = addLineNumbers('a\nb\n', 1);
    const spans = result.match(/<span class="code-line">/g);
    expect(spans).toHaveLength(2); // not 3
  });
});

// ─── injectAnchor ──────────────────────────────────────
describe('injectAnchor', () => {
  it('wraps matching text in a link-anchor span', () => {
    const result = injectAnchor('hello world', 'world', 'lnk-1');
    expect(result).toBe('hello <span class="link-anchor" data-lid="lnk-1">world</span>');
  });

  it('does not modify text inside HTML tags', () => {
    const result = injectAnchor('<span class="world">world</span>', 'world', 'x');
    // "world" inside the tag attribute must not be wrapped; the text node should be
    expect(result).toBe('<span class="world"><span class="link-anchor" data-lid="x">world</span></span>');
  });

  it('escapes special HTML characters in rawText', () => {
    const result = injectAnchor('a < b', '< b', 'y');
    expect(result).toContain('&lt; b');
  });

  it('returns original html when rawText is not found', () => {
    const html = 'no match here';
    expect(injectAnchor(html, 'xyz', '1')).toBe(html);
  });
});

// ─── edgePoint ─────────────────────────────────────────
describe('edgePoint', () => {
  const center = { x: 0, y: 0, w: 100, h: 60 };  // center at (50, 30)

  it('exits from the right edge when target is to the right', () => {
    const target = { x: 200, y: 0, w: 100, h: 60 };
    const pt = edgePoint(center, target);
    expect(pt.x).toBe(100); // right edge of center
  });

  it('exits from the left edge when target is to the left', () => {
    const target = { x: -300, y: 0, w: 100, h: 60 };
    const pt = edgePoint(center, target);
    expect(pt.x).toBe(0); // left edge of center
  });

  it('exits from the bottom edge when target is directly below', () => {
    const target = { x: 0, y: 200, w: 100, h: 60 };
    const pt = edgePoint(center, target);
    expect(pt.y).toBe(60); // bottom edge of center
  });

  it('exits from the top edge when target is directly above', () => {
    const target = { x: 0, y: -200, w: 100, h: 60 };
    const pt = edgePoint(center, target);
    expect(pt.y).toBe(0); // top edge of center
  });
});

// ─── roundedRectRayHit ─────────────────────────────────
describe('roundedRectRayHit', () => {
  // Box: top-left (0,0), bottom-right (100,60), radius 8
  const bl = { x: 0,   y: 0  };
  const br = { x: 100, y: 60 };
  const r  = 8;

  it('returns null when ray misses entirely', () => {
    // Ray starts outside the box and points further away from it
    const result = roundedRectRayHit(200, 200, 300, 300, bl, br, r);
    expect(result).toBeNull();
  });

  it('hits the right straight edge from inside (center → right)', () => {
    const result = roundedRectRayHit(50, 30, 200, 30, bl, br, r);
    expect(result).not.toBeNull();
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(30, 5);
  });

  it('hits the top straight edge from inside (center → top)', () => {
    const result = roundedRectRayHit(50, 30, 50, -100, bl, br, r);
    expect(result).not.toBeNull();
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('hits a corner arc', () => {
    // Ray going toward the top-right corner area
    const result = roundedRectRayHit(50, 30, 110, -10, bl, br, r);
    expect(result).not.toBeNull();
    // Should be near the top-right corner
    expect(result.x).toBeGreaterThan(100 - r);
    expect(result.y).toBeLessThan(r);
  });

  it('returned hit point lies on the boundary', () => {
    const result = roundedRectRayHit(50, 30, 200, 30, bl, br, r);
    // For a straight-edge hit, the point should be exactly on the edge
    expect(result.x).toBeCloseTo(100, 4);
  });
});
