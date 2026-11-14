// Compare throughput and fixed-node output before/after rule caching and TT prefetch.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Engine } from './uci.mjs';
import { kernel } from './kernel.mts';
const ref=process.env.MISTBOARD_CHECKOUT??process.cwd();
const {jieqiStateToPikafishFen,pikafishUciToJieqiMove}=
  await import(pathToFileURL(`${ref}/packages/game/src/jieqi-fen.ts`).href);
const [beforeBinary,afterBinary]=process.argv.slice(2);
const games=JSON.parse(readFileSync(new URL('./selfplay.json',import.meta.url))).games;
const samples=[];
for(const game of [games[0],games[2]]) {
  let seed=45000+game.pair;
  const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  let state=kernel.createInitialJieqiState('equivalence',kernel.createJieqiDeal(rng),
    {repetition:true,...(game.rule==='jqe-v1'?{adjudicationRule:game.rule}:{})});
  let anchor=state,quiet=[];
  for(let ply=0;ply<=32;ply++) {
    if([0,17,32].includes(ply)) samples.push({rule:game.rule,ply,
      fen:jieqiStateToPikafishFen(anchor,{viewer:state.status.turn}),moves:[...quiet]});
    const m=pikafishUciToJieqiMove(game.moves[ply]);
    const irreversible=!!state.board[m.to]||state.board[m.from]?.faceDown===true;
    state=kernel.applyJieqiMove(state,m);
    if(irreversible) {anchor=state;quiet=[];} else quiet.push(game.moves[ply]);
  }
}
const engines=[new Engine(beforeBinary),new Engine(afterBinary)];
for(const e of engines) {await e.init();e.send('setoption name Hash value 64');}
const results=[];
try {
  for(const sample of samples) {
    const readings=[];
    for(const e of engines) {
      e.send('ucinewgame');e.send(`setoption name Jieqi Rule value ${sample.rule}`);
      e.send(`position fen ${sample.fen} moves ${sample.moves.join(' ')}`);e.lines=[];
      const bestmove=await e.until('go nodes 1000000',s=>s.startsWith('bestmove '));
      const info=e.lines.filter(s=>/^info depth /.test(s)).at(-1);
      readings.push({bestmove,score:info.match(/score (cp|mate) -?\d+/)?.[0],
        depth:Number(info.match(/^info depth (\d+)/)?.[1]),nps:Number(info.match(/ nps (\d+)/)?.[1])});
    }
    results.push({...sample,before:readings[0],after:readings[1]});
  }
} finally {for(const e of engines) await e.close();}
writeFileSync(new URL('./node-comparison.json',import.meta.url),JSON.stringify({nodes:1000000,results},null,2)+'\n');
console.log(`Compared ${results.length} fixed-node searches`);
console.log(results.map(r=>({rule:r.rule,ply:r.ply,beforeNps:r.before.nps,afterNps:r.after.nps,beforeScore:r.before.score,afterScore:r.after.score,sameMove:r.before.bestmove.split(' ')[1]===r.after.bestmove.split(' ')[1]})));
