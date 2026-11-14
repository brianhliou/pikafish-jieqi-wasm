import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export class Engine {
  constructor(binary) {
    this.child=spawn(binary,[],{stdio:['pipe','pipe','pipe']}); this.lines=[]; this.pending=null;
    this.stderr=''; this.child.stderr.on('data',d=>{this.stderr+=d;});
    createInterface({input:this.child.stdout}).on('line',line=>{
      this.lines.push(line);
      if(this.pending?.predicate(line)) { const p=this.pending; this.pending=null; clearTimeout(p.timer); p.resolve(line); }
    });
    this.child.on('exit',code=>{if(this.pending) {clearTimeout(this.pending.timer); this.pending.reject(new Error(`engine exit ${code}: ${this.stderr}`)); this.pending=null;}});
  }
  send(command) { this.child.stdin.write(command+'\n'); }
  until(command,predicate,timeout=120000) {
    if(this.pending) throw new Error('overlapping UCI requests');
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending=null;reject(new Error(`UCI timeout: ${command}`));},timeout);
      this.pending={predicate,resolve,reject,timer}; this.send(command);
    });
  }
  async init(rule='legacy') {
    await this.until('uci',s=>s==='uciok');
    this.send('setoption name Threads value 1'); this.send('setoption name Hash value 16');
    this.send(`setoption name Jieqi Rule value ${rule}`);
    await this.until('isready',s=>s==='readyok');
  }
  async close() { this.send('quit'); await new Promise(r=>this.child.once('exit',r)); }
}
