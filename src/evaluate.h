/*
  Stockfish, a UCI chess playing engine derived from Glaurung 2.1
  Copyright (C) 2004-2025 The Stockfish developers (see AUTHORS file)

  Stockfish is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Stockfish is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

#ifndef EVALUATE_H_INCLUDED
#define EVALUATE_H_INCLUDED

#include <string>

#include "types.h"

namespace Stockfish {

class Position;

namespace Eval {

// The checked-in 256-wide net is identified by its compressed SHA-256 prefix.
#define EvalFileDefaultNameBig "jieqi-b395f77e3ee9.nnue.zst"

namespace NNUE {
struct Networks;
struct AccumulatorCaches;
class AccumulatorStack;
}

std::string trace(Position& pos, const Eval::NNUE::Networks& networks);

Value evaluate(const NNUE::Networks&          networks,
               const Position&                pos,
               Eval::NNUE::AccumulatorStack&  accumulators,
               Eval::NNUE::AccumulatorCaches& caches,
               int                            optimism);
}  // namespace Eval

}  // namespace Stockfish

#endif  // #ifndef EVALUATE_H_INCLUDED
