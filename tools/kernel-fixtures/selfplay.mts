// Sequential searches, paired seeded deals, kernel decides every game.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Engine } from './uci.mjs';
import { kernel } from './kernel.mts';
const ref=process.env.MISTBOARD_CHECKOUT??process.cwd();
const {jieqiStateToPikafishFen,jieqiMoveToPikafishUci,pikafishUciToJieqiMove}=
  await import(pathToFileURL(`${ref}/packages/game/src/jieqi-fen.ts`).href);
const [newBinary,oldBinary,seconds='1500',target='100',output='selfplay.json']=process.argv.slice(2);
const engines=[new Engine(newBinary),new Engine(oldBinary)];
for(const engine of engines) {await engine.init(); engine.send('setoption name Hash value 64');}
const started=Date.now(), deadline=started+Number(seconds)*1000;
const report={newBinary,oldBinary,nodesPerMove:1000000,threads:1,hashMb:64,seedBase:45000,
  startedAt:new Date().toISOString(),games:[],unfinished:null,errors:[]};
const save=()=>writeFileSync(new URL(output,import.meta.url),JSON.stringify({...report,elapsedSeconds:(Date.now()-started)/1000},null,2)+'\n');
try {
  for(let game=0;game<Number(target)&&Date.now()<deadline;game++) {
    const pair=Math.floor(game/2),newColor=game%2===0?'red':'black',rule=pair%2===0?'jqe-v1':'legacy';
    let seed=45000+pair;
    const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
    let state=kernel.createInitialJieqiState(`strength-${pair}`,kernel.createJieqiDeal(rng),
      {repetition:true,...(rule==='jqe-v1'?{adjudicationRule:rule}:{})});
    let anchor=state, quiet=[],moves=[],stats=[];
    for(const e of engines) {e.send('ucinewgame');e.send(`setoption name Jieqi Rule value ${rule}`);await e.until('isready',s=>s==='readyok');}
    while(state.status.type==='playing'&&moves.length<500&&Date.now()<deadline) {
      const turn=state.status.turn, index=turn===newColor?0:1,engine=engines[index];
      engine.send(`position fen ${jieqiStateToPikafishFen(anchor,{viewer:turn})} moves ${quiet.join(' ')}`);
      engine.lines=[];
      const line=await engine.until('go nodes 1000000',s=>s.startsWith('bestmove '),180000);
      const best=line.split(' ')[1],m=pikafishUciToJieqiMove(best);
      assert.ok(m,`non-move ${best} in playing kernel game ${game}, ply ${moves.length}`);
      const irreversible=!!state.board[m.to]||state.board[m.from]?.faceDown===true;
      const next=kernel.applyJieqiMove(state,m);
      assert.notEqual(next,state,`illegal ${best} at game ${game} ply ${moves.length}`);
      stats.push({engine:index,info:engine.lines.filter(l=>/^info depth /.test(l)).at(-1)});
      moves.push(best); state=next;
      if(irreversible) {anchor=state;quiet=[];} else quiet.push(jieqiMoveToPikafishUci(m));
      engine.lines=[];
    }
    const record={game,pair,rule,newColor,plies:moves.length,status:state.status,moves,stats};
    if(state.status.type==='finished') {
      const result=state.status.winner===null?'draw':state.status.winner===newColor?'win':'loss';
      report.games.push({...record,result});
      console.log(JSON.stringify({game,rule,newColor,plies:moves.length,result,reason:state.status.reason,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
    } else {report.unfinished=record; console.log(`Unfinished game ${game} after ${moves.length} plies`);}
    save();
    if(report.unfinished) break;
  }
} catch(error) {report.errors.push(String(error.stack??error));save();throw error;}
finally {for(const e of engines) await e.close(); save();}
console.log(JSON.stringify({games:report.games.length,wins:report.games.filter(g=>g.result==='win').length,
  draws:report.games.filter(g=>g.result==='draw').length,losses:report.games.filter(g=>g.result==='loss').length,
  elapsedSeconds:Math.round((Date.now()-started)/1000)}));
