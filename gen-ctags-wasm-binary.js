#!/usr/bin/env node
// Generates ctags-wasm-binary.js from ctags-wasm.wasm.
//
// Usage:
//   node gen-ctags-wasm-binary.js [wasm-file] [output-file]
//
// Defaults:
//   wasm-file   : ../ctags/build-wasm/ctags-wasm.wasm
//   output-file : ctags-wasm-binary.js

const fs   = require('fs');
const path = require('path');

const wasmFile = process.argv[2] || path.join(__dirname, '../ctags/build-wasm/ctags-wasm.wasm');
const outFile  = process.argv[3] || path.join(__dirname, 'ctags-wasm-binary.js');

const buf = fs.readFileSync(wasmFile);
const b64 = buf.toString('base64');

const js =
  'window.__ctagsWasmBinary=(()=>{' +
  'const s=atob("' + b64 + '");' +
  'const u=new Uint8Array(s.length);' +
  'for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);' +
  'return u.buffer;' +
  '})();\n';

fs.writeFileSync(outFile, js);
console.log(`wrote ${outFile} (${(js.length / 1024 / 1024).toFixed(1)} MB)`);
