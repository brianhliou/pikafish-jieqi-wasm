import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Engine } from './uci.mjs';
const binary=process.argv[2]??'src/pikafish';
const engine=new Engine(binary); await engine.init();
assert.ok(engine.lines.includes('option name Jieqi Rule type combo default legacy var legacy var jqe-v1'));
const corpus=['kernel.json','extra-kernel.json'].flatMap(p=>JSON.parse(readFileSync(new URL(p,import.meta.url))).cases);
let probes=0,searches=0;
for(const c of corpus) {
  engine.send(`setoption name Jieqi Rule value ${c.rule}`);
  engine.send(`position fen ${c.fen} moves ${c.moves.join(' ')}`);
  const line=await engine.until(`ruleprobe ${c.ply}`,s=>s.startsWith('info string ruleprobe '));
  const expected=c.id.startsWith('tree-twofold-prune/')?'draw':c.expected;
  const ordinaryMate=['checkmate','stalemate'].includes(c.status.reason)&&c.rule==='legacy';
  assert.equal(line.split(' ')[3],ordinaryMate?'ongoing':expected,c.id);
  const actualFen=line.split(' fen ')[1];
  assert.equal(Number(actualFen.split(' ').at(-2)),c.clock,`${c.id} clock`);
  const again=await engine.until(`ruleprobe ${c.ply}`,s=>s.startsWith('info string ruleprobe '));
  assert.equal(again,line,`${c.id} stable history`);probes+=2;
  if(c.ply===0) {
    engine.lines=[];
    const best=await engine.until('go depth 1',s=>s.startsWith('bestmove '));
    assert.equal(/^(0000|\(none\))$/.test(best.split(' ')[1]),expected!=='ongoing',`${c.id}: ${best}`);
    if(expected!=='ongoing') {
      const score=expected==='draw'?'cp 0':expected==='win'?'mate 1':'mate 0';
      assert.ok(engine.lines.some(s=>s===`info depth 0 score ${score}`),`${c.id} terminal score: ${engine.lines.join(' | ')}`);
    }
    searches++;
  }
  // A fresh FEN intentionally discards history, but must preserve board/pool/clock.
  engine.send(`position fen ${actualFen}`);
  const roundtrip=await engine.until('ruleprobe',s=>s.startsWith('info string ruleprobe '));
  assert.equal(roundtrip.split(' fen ')[1],actualFen,`${c.id} FEN round trip`);probes++;
}
// A warm hash table must not transfer a clock-limit draw to a fresh clock.
engine.send('setoption name Jieqi Rule value jqe-v1');
const clockFen='4k4/9/7n1/9/9/9/9/9/R8/3K5 w X';
for(const clock of [79,0,79]) {
  engine.send(`position fen ${clockFen} ${clock} 1`);
  engine.lines=[];
  await engine.until('go depth 3',s=>s.startsWith('bestmove '));searches++;
  const info=engine.lines.filter(s=>/^info depth /.test(s)).at(-1);
  const cp=Number(info?.match(/score cp (-?\d+)/)?.[1]);
  assert.ok(Number.isFinite(cp),`clock ${clock}: ${info}`);
  assert.equal(cp===0,clock===79,`clock-specific warm TT: ${info}`);
}
const c=corpus.find(c=>c.id==='chase-twofold/jqe-v1');
engine.send('setoption name Threads value 2');
engine.send('setoption name Jieqi Rule value jqe-v1');
engine.send(`position fen ${c.fen} moves ${c.moves.join(' ')}`);
const before=await engine.until('ruleprobe',s=>s.startsWith('info string ruleprobe '));
for(let i=0;i<2;i++) {
  await engine.until('go nodes 20000',s=>s.startsWith('bestmove '));searches++;
  const after=await engine.until('ruleprobe',s=>s.startsWith('info string ruleprobe '));
  assert.equal(after,before,'search must preserve shared root history');probes++;
}
await engine.close();
const report={cases:corpus.length,probes,searches,failures:0};
writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
