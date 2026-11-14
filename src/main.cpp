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

#include <iostream>
#include <string>

#include "bitboard.h"
#include "misc.h"
#include "position.h"
#include "uci.h"
#include "tune.h"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

using namespace Stockfish;

#ifdef __EMSCRIPTEN__
namespace {
UCIEngine& browser_engine() {
    static auto engine = [] {
        std::cout << engine_info() << std::endl;
        Bitboards::init();
        Position::init();
        static char program[] = "PikaJieQi";
        static char* argv[] = {program, nullptr};
        auto* uci = new UCIEngine(1, argv);
        Tune::init(uci->engine_options());
        return uci; // Persistent for the lifetime of the browser module.
    }();
    return *engine;
}
}

extern "C" {
EMSCRIPTEN_KEEPALIVE void pikajieqi_initialize() { browser_engine(); }
EMSCRIPTEN_KEEPALIVE void pikajieqi_command(const char* command) {
    if (command)
        browser_engine().command(command);
}
}
#endif

int main(int argc, char* argv[]) {
#ifdef __EMSCRIPTEN__
    pikajieqi_initialize();
#else

    std::cout << engine_info() << std::endl;

    Bitboards::init();
    Position::init();

    UCIEngine uci(argc, argv);

    Tune::init(uci.engine_options());

    uci.loop();

#endif
    return 0;
}
