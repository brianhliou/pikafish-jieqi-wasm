// Compile the real flip_search body against deterministic identity searches.
// Run with chance_nodes_unit.py; no NNUE or search heuristics can mask a failure.
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <iostream>
#include <map>
#include <string>
#include <tuple>
#include <vector>
#include "types.h"

namespace Stockfish {
struct Position {
    std::vector<std::pair<Piece, int>> reserve{{W_ROOK, 1}, {W_PAWN, 3}};
    std::array<Value, PIECE_NB> shallow{}, deep{};
    Piece revealed = NO_PIECE;
    Color side_to_move() const { return BLACK; }
    auto rest_pieces(Color) const { return reserve; }
    Piece do_flip(Square, Piece piece, DirtyPiece*, int*) {
        assert(revealed == NO_PIECE);
        revealed = piece;
        return NO_PIECE;
    }
    void undo_flip(Square, Piece) { revealed = NO_PIECE; }
};
namespace Search {
enum NodeType { NonPV, PV, Root };
struct Stack { Move currentMove = Move(SQ_A0, SQ_A1); Move* pv = nullptr; };
struct Accumulator {
    struct Entry { DirtyPiece dirtyPiece{}; } entry;
    int size = 1;
    auto latest() const { return entry; }
    void pop() { assert(size == 1); --size; }
    void push(DirtyPiece) { assert(size == 0); ++size; }
};
struct Worker {
    std::map<std::string, bool> options{{"ChanceMix", true}};
    struct { std::atomic<bool> stop{false}; } threads;
    Accumulator accumulatorStack;
    int tt = 0;
    bool interrupt = false;
    std::vector<std::tuple<Piece, Depth, Value, Value, NodeType>> calls;
    template<NodeType nt>
    Value leaf(Position& pos, Stack* ss, Value a, Value b, Depth d) {
        assert(a < b && (nt != NonPV || b == a + 1));
        calls.emplace_back(pos.revealed, d, a, b, nt);
        if constexpr (nt == PV)
            ss->pv[0] = Move::none();
        if (interrupt) threads.stop = true;
        Value v = (d >= 10 ? pos.deep : pos.shallow)[pos.revealed];
        return v <= a ? a : v;  // fail-soft: fail-low clamped, fail-high exact
    }
    template<NodeType nt>
    Value search(Position& p, Stack* s, Value a, Value b, Depth d, bool cut) {
        assert(nt != PV || !cut);
        return leaf<nt>(p, s, a, b, d);
    }
    template<NodeType nt>
    Value qsearch(Position& p, Stack* s, Value a, Value b, int = 0) {
        return leaf<nt>(p, s, a, b, 0);
    }
    template<NodeType nt>
    Value flip_search(Position&, Stack*, Value, Value, bool, Depth, bool
#ifndef BASELINE
                      , int = 0
#endif
    );
};
}  // namespace Search
using namespace Search;
#include "flip_search.inc"
}  // namespace Stockfish

using namespace Stockfish;
int failures = 0, checks = 0;
void check(bool ok, const char* name) {
    ++checks;
    if (!ok) { ++failures; std::cout << "FAIL " << name << '\n'; }
}

int main() {
    Position p;
    Move pv[MAX_PLY + 1]{};
    Stack stacks[2];
    Stack* ss = stacks + 1;
    ss->pv = pv;
    auto call = [&](Worker& w, bool qs = false, int qply = 0, Value a = -VALUE_INFINITE,
                    Value b = VALUE_INFINITE) {
        Value v = w.flip_search<PV>(p, ss, a, b, qs, 10, false
#ifndef BASELINE
                                   , qply
#endif
        );
        check(ss->pv == pv && p.revealed == NO_PIECE && w.accumulatorStack.size == 1,
              "restore PV, position and accumulator stack");
        return v;
    };
    p.shallow[W_ROOK] = p.deep[W_ROOK] = mate_in(4);
    p.shallow[W_PAWN] = p.deep[W_PAWN] = mated_in(8);
    Worker mixed;
    Value v = call(mixed);
    check(!is_decisive(v) && std::abs(v - int(360.83524 * std::log(1.0/3))) <= 1,
          "one winning identity plus three losing identities is a non-mate expectation");
    p.shallow[W_PAWN] = p.deep[W_PAWN] = mate_in(20);
    Worker wins;
    check(call(wins) == mate_in(20), "all wins choose the slowest win");
    p.shallow[W_ROOK] = p.deep[W_ROOK] = mated_in(4);
    p.shallow[W_PAWN] = p.deep[W_PAWN] = mated_in(20);
    Worker losses;
    check(call(losses) == mated_in(20), "all losses choose the longest loss");

    p.reserve = {{W_ROOK, 1}, {W_PAWN, 1}};
    p.shallow[W_ROOK] = p.deep[W_ROOK] = -1000;
    p.shallow[W_PAWN] = p.deep[W_PAWN] = 1000;
    Worker clamping;
    Value narrow = clamping.flip_search<NonPV>(p, ss, 0, 1, false, 10, true);
    check(narrow == 0, "opposite fail-soft bounds do not bias the null-window expectation");
#ifndef BASELINE
    check(clamping.calls.size() == 3, "two shallow probes and one full-depth search");
    for (int i = 0; i < 2; ++i) {
        auto [piece, d, a, b, nt] = clamping.calls[i];
        check(d == 4 && a == -VALUE_INFINITE && b == VALUE_INFINITE && nt == PV,
              "probes use depth minus six and open PV windows even below NonPV");
    }
    Worker qs;
    call(qs, true);
    check(qs.calls.size() == 2, "qsearch has no additional deep pass");
    p.shallow[W_ROOK] = p.shallow[W_PAWN] = mate_in(4);
    Worker firstQmove;
    check(is_decisive(call(firstQmove, true, 1)) && firstQmove.calls.size() == 2,
          "the first qsearch move still expands all identities, matching jqe child qply zero");
    Worker nested;
    check(!is_decisive(call(nested, true, 2)) && nested.calls.size() == 1,
          "nested qsearch samples a representative without claiming mate");
    Worker stopped;
    stopped.interrupt = true;
    check(call(stopped) == VALUE_ZERO && stopped.calls.size() == 1,
          "stop after a probe restores state and returns immediately");
    p.reserve = {{W_ROOK, 1}, {W_PAWN, 3}};
    p.shallow.fill(0); p.deep.fill(0); p.deep[W_PAWN] = 400;
    Worker weighted;
    v = call(weighted);
    double wr = .25 * .5 + .75 / (1 + std::exp(-400 / 360.83524));
    check(std::abs(v - int(360.83524 * std::log(wr / (1-wr)))) <= 1,
          "replace the most numerous identity's probe and weight by counts");
    check(std::get<0>(weighted.calls.back()) == W_PAWN
          && std::get<1>(weighted.calls.back()) == 10, "full depth uses most numerous identity");
    for (int i = 0; i < 200; ++i) {
        p.shallow[W_ROOK] = (i * 137 % 1801) - 900;
        p.shallow[W_PAWN] = (i * 103 % 1801) - 900;
        p.deep[W_PAWN] = (i * 271 % 2001) - 1000;
        const auto probability = [](Value x) { return 1 / (1 + std::exp(-x / 360.83524)); };
        double mean = .25 * probability(p.shallow[W_ROOK]) + .75 * probability(p.deep[W_PAWN]);
        Value exact = int(360.83524 * std::log(mean / (1-mean)));
        Value alpha = exact + (i % 9) - 4, beta = alpha + 1;
        Worker bound;
        Value result = bound.flip_search<NonPV>(p, ss, alpha, beta, false, 10, true);
        check(exact <= alpha ? result <= alpha : result >= beta,
              "mapped null-window result bounds the weighted approximation");
    }
#endif
    std::cout << checks << " checks, " << failures << " failures\n";
    return failures != 0;
}
