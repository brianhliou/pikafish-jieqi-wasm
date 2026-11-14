/*
 * Port of Mistboard packages/game/src/jieqi-chase.ts, itself a port of
 * native/chase.cpp from https://github.com/devinokeefe/jieqi
 * commit 331a6e612a038c4a04cf980f7b9482910fd50078.
 *
 * MIT License
 * Copyright (c) 2026 Devin O'Keefe
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#ifndef JIEQI_CHASE_H_INCLUDED
#define JIEQI_CHASE_H_INCLUDED

#include <array>
#include <bitset>
#include <cmath>
#include <utility>
#include <vector>
#include "types.h"

namespace Stockfish::JieqiChase {

// Public positional types, including stationary dark pieces. Darkness is
// deliberately discarded for hypothetical advisor/elephant capture geometry.
using Board = std::array<Piece, 90>;
using Targets = std::bitset<90>;
using Ids = std::array<int, 90>;
inline int x(int s) { return s % 9; }
inline int y(int s) { return s / 9; }
inline int sign(int n) { return (n > 0) - (n < 0); }

inline int intervening(const Board& b, int from, int to) {
    if (from == to || (x(from) != x(to) && y(from) != y(to)))
        return -1;
    int step = sign(x(to) - x(from)) + 9 * sign(y(to) - y(from));
    int count = 0;
    for (int s = from + step; s != to; s += step)
        count += b[s] != NO_PIECE;
    return count;
}

inline bool geometry(const Board& b, int from, int to) {
    if (!b[from] || from == to)
        return false;
    int dx = x(to) - x(from), dy = y(to) - y(from);
    int ax = std::abs(dx), ay = std::abs(dy);
    Color c = color_of(b[from]);
    switch (type_of(b[from])) {
    case KING:
        return ax + ay == 1 && x(to) >= 3 && x(to) <= 5
            && (c == WHITE ? y(to) <= 2 : y(to) >= 7);
    case ROOK: return intervening(b, from, to) == 0;
    case CANNON: return intervening(b, from, to) == (b[to] ? 1 : 0);
    case KNIGHT:
        return ((ax == 2 && ay == 1) || (ax == 1 && ay == 2))
            && !b[from + (ax == 2 ? sign(dx) : 9 * sign(dy))];
    case BISHOP: return ax == 2 && ay == 2 && !b[from + dx / 2 + 9 * (dy / 2)];
    case ADVISOR: return ax == 1 && ay == 1;
    case PAWN:
        return (dx == 0 && dy == (c == WHITE ? 1 : -1))
            || (dy == 0 && ax == 1 && (c == WHITE ? y(from) >= 5 : y(from) <= 4));
    default: return false;
    }
}

inline Board relocate(Board b, int from, int to) {
    b[to] = b[from];
    b[from] = NO_PIECE;
    return b;
}

inline int king_square(const Board& b, Color c) {
    for (int s = 0; s < 90; ++s)
        if (b[s] == make_piece(c, KING))
            return s;
    assert(false);
    return 0;
}

inline bool attacked(const Board& b, Color c) {
    int king = king_square(b, c);
    for (int s = 0; s < 90; ++s)
        if (b[s] && color_of(b[s]) != c
            && (type_of(b[s]) == KING ? intervening(b, s, king) == 0 : geometry(b, s, king)))
            return true;
    return false;
}

inline bool safe_capture(const Board& b, int from, int to) {
    return b[from] && b[to] && type_of(b[to]) != KING
        && color_of(b[from]) != color_of(b[to]) && geometry(b, from, to)
        && !attacked(relocate(b, from, to), color_of(b[from]));
}

inline std::pair<Targets, Targets> pins(const Board& b, Color actor) {
    int king = king_square(b, actor);
    std::vector<std::pair<int, Targets>> paths;
    Targets omitted, blocked, pinning;
    for (int s = 0; s < 90; ++s) {
        if (!b[s] || color_of(b[s]) == actor)
            continue;
        int dx = x(king) - x(s), dy = y(king) - y(s);
        int ax = std::abs(dx), ay = std::abs(dy);
        PieceType pt = type_of(b[s]);
        Targets path;
        if ((pt == ROOK || pt == CANNON || pt == KING) && (dx == 0 || dy == 0)) {
            int step = sign(dx) + 9 * sign(dy);
            for (int q = s + step; q != king; q += step)
                path.set(q);
        } else if (pt == KNIGHT && ((ax == 2 && ay == 1) || (ax == 1 && ay == 2)))
            path.set(s + (ax == 2 ? sign(dx) : 9 * sign(dy)));
        else if (pt == BISHOP && ax == 2 && ay == 2)
            path.set(s + dx / 2 + 9 * (dy / 2));
        else
            continue;
        paths.emplace_back(s, path);
        if (pt != CANNON)
            omitted.set(s);
    }
    for (const auto& [s, path] : paths) {
        bool cannon = type_of(b[s]) == CANNON;
        Targets screens;
        bool own = false;
        for (int q = 0; q < 90; ++q)
            if (path[q] && b[q] && (cannon || !omitted[q])) {
                screens.set(q);
                own |= color_of(b[q]) == actor;
            }
        if (screens.count() == (cannon ? 2u : 1u)) {
            blocked |= screens;
            if (own)
                pinning.set(s);
        }
    }
    return {blocked, pinning};
}

inline Targets targets(const Board& b, const Ids& ids, Color actor) {
    auto [blocked, pinning] = pins(b, actor);
    Targets result;
    for (int to = 0; to < 90; ++to) {
        if (!b[to] || type_of(b[to]) == KING || color_of(b[to]) == actor)
            continue;
        PieceType victim = type_of(b[to]);
        for (int from = 0; from < 90; ++from) {
            if (!b[from] || color_of(b[from]) != actor)
                continue;
            PieceType p = type_of(b[from]);
            if (p == KING || p == PAWN)
                continue;
            if (blocked[from]) {
                if (!pinning[to])
                    continue;
            } else if (victim == PAWN && (color_of(b[to]) == WHITE ? y(to) <= 4 : y(to) >= 5))
                continue;
            if (!safe_capture(b, from, to))
                continue;
            bool exception = ((p == KNIGHT || p == CANNON) && victim == ROOK)
                || ((p == ADVISOR || p == BISHOP)
                    && (victim == ROOK || victim == KNIGHT || victim == CANNON));
            if (!exception) {
                Board captured = relocate(b, from, to);
                bool protectedTarget = false;
                for (int s = 0; s < 90; ++s)
                    if (captured[s] && color_of(captured[s]) == color_of(b[to])
                        && safe_capture(captured, s, to)) {
                        protectedTarget = true;
                        break;
                    }
                if (protectedTarget || (p == victim && safe_capture(b, to, from)))
                    continue;
            }
            result.set(ids[to]);
            break;
        }
    }
    return result;
}

} // namespace Stockfish::JieqiChase
#endif
