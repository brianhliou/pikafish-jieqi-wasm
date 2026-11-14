// Standalone probe: no search or engine initialization, just public chase types.
#include <iostream>
#include <string>
#include "jieqi_chase.h"
int main() {
    using namespace Stockfish;
    using namespace Stockfish::JieqiChase;
    std::string line;
    const std::string codes = ".RACPNBK.racpnbk";
    while (std::getline(std::cin, line)) {
        if (line.size() != 90) return 2;
        Board b{};
        Ids ids{};
        for (int s = 0; s < 90; ++s) {
            auto i = codes.find(line[s]);
            if (i == std::string::npos) return 3;
            b[s] = Piece(i); ids[s] = s;
        }
        for (Color c : {WHITE, BLACK}) {
            Targets t = targets(b, ids, c);
            for (int s = 0; s < 90; ++s) if (t[s]) std::cout << s << ',';
            std::cout << ';';
        }
        std::cout << '\n';
    }
}
