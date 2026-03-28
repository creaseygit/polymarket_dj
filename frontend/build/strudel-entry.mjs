// Strudel bundle entry point for Polymarket DJ
// Imports from @strudel/web SOURCE (web.mjs, not the pre-built dist)
// so that @strudel/core is shared with @strudel/soundfonts — no duplicate.

// Import from the source entry which re-exports individual packages
export * from '@strudel/web/web.mjs';

// Import soundfonts and expose on window
import { registerSoundfonts, setSoundfontUrl, loadSoundfont } from '@strudel/soundfonts';
window.registerSoundfonts = registerSoundfonts;
window.setSoundfontUrl = setSoundfontUrl;
window.loadSoundfont = loadSoundfont;

// Import aliasBank for drum machine aliases (rd, rim, etc.)
import { aliasBank } from 'superdough';
window.aliasBank = aliasBank;
