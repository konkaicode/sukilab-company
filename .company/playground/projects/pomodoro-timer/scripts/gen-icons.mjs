import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(projectRoot, 'public', 'favicon.svg'));

await sharp(svg).resize(192, 192).png().toFile(path.join(projectRoot, 'public', 'icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(path.join(projectRoot, 'public', 'icon-512.png'));

console.log('Icons generated: icon-192.png, icon-512.png');
