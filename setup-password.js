'use strict';
// Usage: node setup-password.js   (run from an elevated terminal in the project folder)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ask(q) { // hidden input
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) { console.error('Run this in an interactive terminal.'); process.exit(1); }
    process.stdout.write(q);
    const si = process.stdin; si.setRawMode(true); si.resume(); si.setEncoding('utf8');
    let buf = '';
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          si.setRawMode(false); si.pause(); si.off('data', onData);
          process.stdout.write('\n'); return resolve(buf);
        }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1); else buf += c;
      }
    };
    si.on('data', onData);
  });
}

(async () => {
  const pw = await ask('New password (min 10 chars): ');
  const pw2 = await ask('Repeat password: ');
  if (pw !== pw2) { console.error('Passwords do not match.'); process.exit(1); }
  if (pw.length < 10 || pw.length > 256) { console.error('Use 10-256 characters.'); process.exit(1); }

  const N = 32768, r = 8, p = 1, keylen = 64;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, keylen, { N, r, p, maxmem: 128 * 1024 * 1024 });
  const encoded = ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');

  const target = path.join(__dirname, 'config.json');
  const src = fs.existsSync(target) ? target : path.join(__dirname, 'config.example.json');
  const cfg = JSON.parse(fs.readFileSync(src, 'utf8'));
  cfg.passwordHash = encoded;
  fs.writeFileSync(target, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  console.log('Saved hash to config.json. Run install.ps1 to lock down its permissions.');
})();