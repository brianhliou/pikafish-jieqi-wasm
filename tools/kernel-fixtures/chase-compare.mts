import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { position, sq, kernel } from './kernel.mts';
const ref=process.env.MISTBOARD_CHECKOUT??process.cwd();
const {jieqiChaseTargets}=await import(pathToFileURL(`${ref}/packages/game/src/jieqi-chase.ts`).href);
const home=kernel.createInitialJieqiState('home').board;
const roleCode={general:'K',chariot:'R',cannon:'C',advisor:'A',elephant:'B',horse:'N',soldier:'P'};
const encode=(board)=>Array.from({length:90},(_,i)=>{
  const p=board[sq(`${String.fromCharCode(97+i%9)}${Math.floor(i/9)}`)];
  if(!p) return '.';
  const c=roleCode[p.faceDown?home[sq(`${String.fromCharCode(97+i%9)}${Math.floor(i/9)}`)].role:p.role];
  return p.color==='red'?c:c.toLowerCase();
}).join('');
const expected=(board)=>['red','black'].map(color=>[...jieqiChaseTargets(board,color)].map(s=>(Number(s.slice(1))-1)*9+s.charCodeAt(0)-97).sort((a,b)=>a-b).map(s=>`${s},`).join('')+';').join('');
const boards=[];
for(const minor of ['A','B']) for(const t of ['r','n','c'])
  boards.push(position({d0:'K',f9:'k',b3:minor,[minor==='A'?'c4':'d5']:t,[minor==='A'?'i4':'i5']:'r'}).board);
for(const pieces of [
  {d0:'K',f9:'k',b3:'N',c5:'n'}, {d0:'K',f9:'k',b3:'N',c5:'n',c4:'P'},
  {d0:'X',e0:'K',f9:'k',c1:'r'}, {d0:'K',f9:'k',a3:'R',b3:'n',b9:'r',a9:'R'},
  {d0:'K',f9:'k',d3:'N',d8:'r',e5:'p'}, {e0:'K',d9:'k',f0:'n'},
  {d0:'K',f9:'k',a5:'P',b5:'n'}, {d0:'K',f9:'k',a5:'R',a6:'p'},
  {d0:'K',f9:'k',a5:'R',a4:'p'}, {d0:'K',f9:'k',a3:'R',b3:'n',b9:'r'}
]) boards.push(position(pieces).board);
let seed=45045;
const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
// Include 600 reachable public boards, with captures, reveals, pinned and dark pieces.
for(let game=0;game<6;game++) {
  let state=kernel.createInitialJieqiState(`chase-${game}`,kernel.createJieqiDeal(rng),{repetition:true,adjudicationRule:'jqe-v1'});
  for(let ply=0;ply<100&&state.status.type==='playing';ply++) {
    boards.push(state.board);
    const legal=kernel.getJieqiLegalMoves(state);
    state=kernel.applyJieqiMove(state,legal[Math.floor(rng()*legal.length)]);
  }
}
const input=boards.map(encode).join('\n')+'\n';
const result=spawnSync(process.argv[2],[],{input,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const actual=result.stdout.trimEnd().split('\n');
assert.equal(actual.length,boards.length);
boards.forEach((b,i)=>assert.equal(actual[i],expected(b),`chase board ${i}: ${encode(b)}`));
const report={boards:boards.length,actors:boards.length*2,failures:0,seed:45045};
writeFileSync(new URL('./chase-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(report);
