#!/usr/bin/env node
// MnemoniQR · Used by tools/goal.py: reads {target_usd, start, addresses} on stdin and prints the live goal as
// JSON, with exactly the code the campaign page runs (web/api/goal.js). Needs Node 18 or later (fetch).
'use strict';
const { collect } = require('../web/api/goal.js');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', async () => {
    try {
        process.stdout.write(JSON.stringify(await collect(JSON.parse(input))));
    } catch (e) {
        process.stderr.write(`goal_collect: ${(e && e.message) || e}\n`);
        process.exit(1);
    }
});
