"""Extract the pre-rules serving commit; add only a read-only rule probe."""
import io
import pathlib
import subprocess
import tarfile

root = pathlib.Path(__file__).resolve().parents[2]
target = root / 'tools/kernel-fixtures/.build/baseline'
target.mkdir(parents=True, exist_ok=True)
archive = subprocess.check_output(['git', 'archive', 'fd1a6f8'], cwd=root)
with tarfile.open(fileobj=io.BytesIO(archive)) as source:
    source.extractall(target, filter='data')
p = target / 'src/engine.h'
s = p.read_text()
s = s.replace('    void stop();', '''    void stop();
    std::string rule_probe(int ply) {
        wait_for_search_finished();
        Value result = VALUE_NONE;
        bool terminal = pos.rule_judge(result, ply);
        return std::string("ruleprobe ")
          + (!terminal ? "ongoing" : result == VALUE_DRAW ? "draw" : result > 0 ? "win" : "loss")
          + " fen " + pos.fen();
    }''')
p.write_text(s)
p = target / 'src/uci.cpp'
s = p.read_text().replace('    else if (token == "compiler")', '''    else if (token == "ruleprobe") {
        int ply = 0;
        is >> ply;
        print_info_string(engine.rule_probe(ply));
    }
    else if (token == "compiler")''', 1)
p.write_text(s)
print(target)
