#!/usr/bin/env node
/** helper only prints the fixed code length — MCP applies the update */
import { readFileSync } from 'fs'
const js = readFileSync(new URL('./avaliar-fixed.js', import.meta.url), 'utf8')
console.log(js.length)
console.log(js.includes("ocrStatus: 'NOT_REQUIRED'"))
console.log(!js.includes('NOT_APPLICABLE'))
