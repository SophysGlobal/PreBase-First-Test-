#!/usr/bin/env node
/**
 * Electron 42+ no longer downloads its binary via npm postinstall.
 * Run this after install so electron-vite can find the executable.
 */
const { spawnSync } = require('child_process')
const path = require('path')

const installScript = path.join(__dirname, '..', 'node_modules', 'electron', 'install.js')
const result = spawnSync(process.execPath, [installScript], { stdio: 'inherit' })

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
