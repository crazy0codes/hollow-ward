import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = await readFile(resolve(import.meta.dirname, '../src/main.js'), 'utf8');
const match = source.match(/const MAP = \[([\s\S]*?)\];/);
if (!match) throw new Error('Could not locate MAP in src/main.js');
const map = [...match[1].matchAll(/'([#.]+)'/g)].map((m) => m[1]);
if (!map.length || !map.every((row) => row.length === map[0].length)) throw new Error('Map rows must have matching widths');
const rows = map.length, cols = map[0].length;
const open = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && map[r][c] === '.';
const walk = (start) => {
  const queue = [start], seen = new Set([String(start[0]) + ',' + String(start[1])]);
  for (let i = 0; i < queue.length; i++) {
    const [r, c] = queue[i];
    for (const [nr, nc] of [[r - 1,c],[r + 1,c],[r,c - 1],[r,c + 1]]) {
      const id = String(nr) + ',' + String(nc);
      if (open(nr, nc) && !seen.has(id)) { seen.add(id); queue.push([nr, nc]); }
    }
  }
  return seen;
};
const start = [9, 5];
const reachable = walk(start);
const allWalkable = map.flatMap((row, r) => [...row].flatMap((cell, c) => cell === '.' ? [[r, c]] : []));
if (reachable.size !== allWalkable.length) {
  const isolated = allWalkable.filter(([r, c]) => !reachable.has(String(r) + ',' + String(c)));
  throw new Error('Found unreachable walkable cells: ' + isolated.map(([r,c]) => String(r) + ',' + String(c)).join(' '));
}
const goals = [[2, 1], [2, 8], [8, 2], [5, 5]];
for (const [r, c] of goals) {
  if (!open(r, c)) throw new Error('Goal is not walkable at row ' + r + ', col ' + c);
  if (!reachable.has(String(r) + ',' + String(c))) throw new Error('Goal is unreachable at row ' + r + ', col ' + c);
}
console.log('Level check passed: ' + rows + 'x' + cols + ', ' + allWalkable.length + ' walkable cells; spawn, all 3 echo relays and the receiver are connected.');
