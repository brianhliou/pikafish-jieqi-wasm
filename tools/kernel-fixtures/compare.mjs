import { readFileSync, writeFileSync } from 'node:fs';
import { Engine } from './uci.mjs';
const [binary,output,corpusPath]=process.argv.slice(2);
if(!binary||!output) throw new Error('usage: node compare.mjs ENGINE OUTPUT.json');
const corpus=JSON.parse(readFileSync(new URL(corpusPath??'./kernel.json',import.meta.url)));
const engine=new Engine(binary); await engine.init(); const results=[];
for(const c of corpus.cases) {
  engine.send(`setoption name Jieqi Rule value ${c.rule}`);
  engine.send(`position fen ${c.fen} moves ${c.moves.join(' ')}`);
  const line=await engine.until(`ruleprobe ${c.ply}`,s=>s.startsWith('info string ruleprobe '));
  let actual=line.split(' ')[3];
  let search;
  if(['checkmate','stalemate'].includes(c.status.reason)) {
    engine.lines=[];
    search=await engine.until('go depth 1',s=>s.startsWith('bestmove '));
    if(!/^bestmove (0000|\(none\))/.test(search) || !engine.lines.some(s=>/score mate -?0(?: |$)/.test(s)))
      throw new Error(`expected root mate/stalemate: ${c.id}: ${search}`);
    actual='loss';
  }
  const expected=c.id.startsWith('tree-twofold-prune/')?'draw':c.expected;
  results.push({id:c.id,expected:c.expected,searchExpected:expected,actual,agree:actual===expected,probe:line,...(search?{search}:{})});
}
await engine.close();
writeFileSync(output,JSON.stringify({binary,recordedAt:new Date().toISOString(),results},null,2)+'\n');
console.log(`${results.filter(r=>r.agree).length}/${results.length} agree; wrote ${output}`);

if (results.some(r => !r.agree)) process.exitCode = 1;
