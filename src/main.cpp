/*
  Stockfish, a UCI chess playing engine derived from Glaurung 2.1
  Copyright (C) 2004-2022 The Stockfish developers (see AUTHORS file)
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

#include "bitboard.h"
#include "position.h"
#include "search.h"
#include "thread.h"
#include "uci.h"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

using namespace Stockfish;

namespace {

void initialize_engine(int argc, char* argv[]) {
  static bool initialized = false;
  if (initialized)
      return;
  initialized = true;

  std::cout << engine_info() << std::endl;

  CommandLine::init(argc, argv);
  UCI::init(Options);
  Tune::init();
  PSQT::init();
  Bitboards::init();
  Position::init();
  Threads.set(size_t(Options["Threads"]));
  Search::clear(); // After threads are up
  Eval::NNUE::init();
}

}

#ifdef __EMSCRIPTEN__
extern "C" {

EMSCRIPTEN_KEEPALIVE
void pikajieqi_initialize() {
  char program[] = "PikaJieQi";
  char* argv[] = {program, nullptr};
  initialize_engine(1, argv);
}

EMSCRIPTEN_KEEPALIVE
void pikajieqi_command(const char* command) {
  if (command)
      UCI::command(command);
}

}
#endif

int main(int argc, char* argv[]) {

  initialize_engine(argc, argv);

#ifndef __EMSCRIPTEN__
  UCI::loop(argc, argv);

  Threads.set(0);
#endif
  return 0;
}
