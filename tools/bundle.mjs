import { build } from 'esbuild';
await build({entryPoints:['src/main.js'],bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,outfile:'.cache/app.js',legalComments:'inline'});
