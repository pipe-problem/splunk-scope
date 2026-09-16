#!/usr/bin/env node
/**
 * Emit the Cursor-assisted import extraction prompt (stdout).
 * Usage: node scripts/generate-import-prompt.mjs > scope-import-prompt.txt
 */
import { loadAppModule } from './lib/viteModuleLoader.mjs';

const { buildCircuitExtractionPrompt } = await loadAppModule('src/services/circuitPromptBuilder.js');
process.stdout.write(buildCircuitExtractionPrompt());
