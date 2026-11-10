#!/usr/bin/env node
const fs = require('fs');
const http = require('http');

function inject(on) {
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const flags = JSON.stringify({ reducedMotion: on });
  return html.replace('</head>', `<script>window.__CQ_FLAGS__=${flags};</script>\n</head>`);
}

const off = inject(false);
const on = inject(true);
if (!off.includes('"reducedMotion":false')) throw new Error('off inject failed');
if (!on.includes('"reducedMotion":true')) throw new Error('on inject failed');

http.get('http://127.0.0.1:3000/nh', (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    if (!body.includes('window.__CQ_FLAGS__={"reducedMotion":false}')) {
      throw new Error(`live server missing default-off flags: ${body.slice(0, 200)}`);
    }
    console.log('motion flag checks passed (default off on :3000; on/off inject both ok)');
  });
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
});
