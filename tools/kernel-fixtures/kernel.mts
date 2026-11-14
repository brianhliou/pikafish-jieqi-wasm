// Run from the read-only Mistboard checkout with its tsx loader. All output is here.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';
const reference = process.env.MISTBOARD_CHECKOUT ?? process.cwd();
const kernel = await import(pathToFileURL(`${reference}/packages/game/src/variants-jieqi.ts`).href);
const chase = await import(pathToFileURL(`${reference}/packages/game/src/jieqi-chase.ts`).href);
const roles = {K:'general', R:'chariot', N:'horse', B:'elephant', A:'advisor', C:'cannon', P:'soldier', X:'soldier'};
export const sq = (s) => `${s[0]}${Number(s.slice(1)) + 1}`;
export const move = (s) => ({from:sq(s.slice(0,2)), to:sq(s.slice(2,4))});
export function position(pieces, turn='red', idle=0, rule='legacy') {
  const board = Object.fromEntries(Object.entries(pieces).map(([s,c]) => [sq(s), {
    color: c === c.toUpperCase() ? 'red' : 'black', role:roles[c.toUpperCase()], faceDown:c.toUpperCase()==='X'
  }]));
  const stamp = rule === 'jqe-v1' ? rule : undefined;
  const key = kernel.jieqiRepetitionPositionKey(board,turn,stamp);
  return {id:'engine-kernel-fixtures', board, status:{type:'playing',turn}, captures:[], moveNumber:1,
    noCaptureClock:idle, ...(stamp ? {adjudicationRule:stamp} : {}), positionCounts:{[key]:1},
    repetitionLog:[{key,...(stamp ? {chase:chase.createJieqiChasePosition(board)} : {})}]};
}
export function fen(state) {
  const codes = Object.fromEntries(Object.entries(roles).map(([c,r])=>[r,c])); codes.soldier='P';
  const rows = [];
  for(let y=9;y>=0;y--) {
    let row='', empty=0;
    for(let x=0;x<9;x++) {
      const p=state.board[sq(`${String.fromCharCode(97+x)}${y}`)];
      if(!p) {empty++;continue;}
      if(empty) row+=empty; empty=0;
      let c=p.faceDown?'X':codes[p.role]; row+=p.color==='red'?c:c.toLowerCase();
    }
    if(empty) row+=empty; rows.push(row);
  }
  // X is an empty pool marker; provide a soldier for each synthetic dark soldier.
  let pool='';
  for(const color of ['red','black']) {
    const n=Object.values(state.board).filter(p=>p.color===color&&p.faceDown).length;
    if(n) pool+=`${color==='red'?'P':'p'}${n}`;
  }
  return `${rows.join('/')} ${state.status.turn==='black'?'b':'w'} ${pool||'X'} ${state.noCaptureClock} ${state.moveNumber}`;
}
export function play(state, uci) {
  const next=kernel.applyJieqiMove(state,move(uci));
  assert.notEqual(next,state,`kernel rejected ${uci}: ${JSON.stringify(state.status)}`);
  return next;
}
export {kernel};
if(process.argv[2] === 'record') {
  const cases=JSON.parse(readFileSync(new URL(process.argv[3]??'./cycles.json',import.meta.url),'utf8'));
  const output=[];
  for(const c of cases) for(const rule of c.rules??['legacy','jqe-v1']) {
    let state=position(c.pieces,c.turn??'red',c.idle??0,rule);
    const startFen=fen(state), timeline=[];
    for(const m of c.moves) {state=play(state,m); timeline.push({move:m,status:state.status,clock:state.noCaptureClock});}
    const next=c.moves.length%2 ? (c.turn??'red')==='red'?'black':'red' : c.turn??'red';
    const s=state.status;
    output.push({id:`${c.id}/${rule}`,rule,fen:startFen,moves:c.moves,ply:c.ply??0,
      expected:s.type==='playing'?'ongoing':s.winner===null?'draw':s.winner===next?'win':'loss',
      status:s,clock:state.noCaptureClock,interval:kernel.jieqiRepeatedInterval(state).length,timeline});
  }
  writeFileSync(new URL(process.argv[4]??'./kernel.json',import.meta.url),JSON.stringify({reference,recordedAt:new Date().toISOString(),cases:output},null,2)+'\n');
  console.log(`Recorded ${output.length} kernel cases`);
}
