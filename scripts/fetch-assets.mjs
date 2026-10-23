import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const assets = [
  {
    name: 'CC0 animated stalker rig',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/eba30de865cfbf31ac736f792defd9a60ff28d57/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
    destination: 'public/assets/RobotExpressive.glb',
    maxBytes: 15 * 1024 * 1024,
    sha256: '047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319',
  },
  {
    name: 'CC0 hospital corridor floor tile',
    url: 'https://cdn.3dassets.dev/assets/23660/v1/model.glb',
    destination: 'public/assets/corridor-floor-tile.glb',
    maxBytes: 2 * 1024 * 1024,
  },
];
let failures = 0;
await mkdir(resolve(root, 'public/assets'), { recursive: true });
for (const asset of assets) {
  const destination = resolve(root, asset.destination);
  try {
    try {
      const existing = await readFile(destination);
      const valid = existing.subarray(0, 4).toString('ascii') === 'glTF'
        && existing.length > 20
        && existing.length <= asset.maxBytes
        && (!asset.sha256 || createHash('sha256').update(existing).digest('hex') === asset.sha256);
      if (valid) { console.log('Asset ready: ' + asset.destination + ' (' + (existing.length / 1024).toFixed(1) + ' KiB)'); continue; }
      await rm(destination, { force: true });
    } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 20 || bytes.length > asset.maxBytes) throw new Error('unexpected file size (' + bytes.length + ' bytes)');
    if (bytes.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error('response is not a binary glTF file');
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (asset.sha256 && digest !== asset.sha256) throw new Error('SHA-256 mismatch (' + digest + ')');
    await mkdir(dirname(destination), { recursive: true });
    const temp = destination + '.download';
    await writeFile(temp, bytes);
    await rename(temp, destination);
    console.log('Fetched ' + asset.name + ': ' + asset.destination + ' (' + (bytes.length / 1024).toFixed(1) + ' KiB)');
  } catch (error) {
    failures++;
    console.warn('Could not fetch ' + asset.name + '. ' + (error?.message ?? error));
    console.warn('Source: ' + asset.url);
    console.warn('Continuing: the game has a local fallback for this missing model.');
  }
}
if (failures > 0) console.warn('Asset setup finished with ' + failures + ' download(s) unavailable. An internet connection is needed to fetch missing binaries.');
