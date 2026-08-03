# Architecture Paths Matrix Results

Generated: 2026-06-11T16:06:24.111Z

**PASS:** 34/47 · **FAIL:** 13/47

| # | Scenario | Budget | Crawl | Walk A | Walk B | Run | Sources C/A/B/R | Distinct sets | Result | Notes |
|---|----------|--------|-------|--------|--------|-----|-----------------|---------------|--------|-------|
| 1 | Marion 14-src · $100k cloud | 100 | 79.1 | 97.2 | 99.6 | 199.2 | 16/17/16/24 | 3/3 | PASS | — |
| 2 | Marion 14-src · $100k hybrid | 100 | 79.1 | 97.2 | 99.6 | 199.2 | 16/17/16/24 | 3/3 | PASS | — |
| 3 | Marion 14-src · $200k cloud | 200 | 159.9 | 197.2 | 204.0 | 397.0 | 25/21/30/29 | 3/3 | PASS | — |
| 4 | Marion 14-src · $350k cloud | 350 | 238.0 | 340.0 | 347.4 | 697.0 | 33/38/26/30 | 3/3 | PASS | — |
| 5 | Marion 14-src · $650k cloud | 650 | 448.0 | 660.9 | 635.4 | 1048.0 | 46/35/26/50 | 3/3 | PASS | — |
| 6 | Marion 14-src · $65k onprem | 100 | 79.1 | 97.2 | 99.6 | 199.2 | 16/17/16/24 | 3/3 | PASS | — |
| 7 | Marion 14-src · $130k onprem | 200 | 159.9 | 197.2 | 204.0 | 397.0 | 25/21/30/29 | 3/3 | PASS | — |
| 8 | Marion 14-src · $650k onprem | 1000 | 748.0 | 982.0 | 976.0 | 1648.0 | 49/46/48/51 | 3/3 | PASS | — |
| 9 | Marion · no budget | — | 8.1 | 9.6 | 9.6 | 9.6 | 6/8/8/8 | 2/3 | FAIL | walkA === walkB sources |
| 10 | Marion · scale 0.5× · $100k cloud | 100 | 75.8 | 101.1 | 101.3 | 199.7 | 18/21/20/26 | 3/3 | PASS | — |
| 11 | Marion · scale 2× · $650k cloud | 650 | 457.6 | 631.6 | 658.3 | 1057.6 | 46/38/21/50 | 3/3 | PASS | — |
| 12 | Perimeter 6 · $100k cloud | 100 | 72.4 | 99.4 | 100.9 | 199.3 | 12/15/15/25 | 3/3 | PASS | — |
| 13 | Perimeter 6 · $50k cloud | 50 | 37.1 | 49.9 | 42.9 | 99.4 | 11/14/13/25 | 3/3 | PASS | — |
| 14 | Perimeter 6 · no budget | — | 7.6 | 7.6 | 7.6 | 7.6 | 5/5/5/5 | 1/3 | FAIL | crawl/walkA/walkB identical source sets; all three paths same GB and same sources |
| 15 | Identity 5 · $100k cloud | 100 | 104.7 | 104.7 | 199.9 | 249.9 | 2/2/19/29 | 2/3 | FAIL | crawl 104.7 > 80% cap (80.0); walkA 104.7 > 103% cap; walkB 199.9 > 103% cap; crawl === walkA sources |
| 16 | Identity 5 · $50k cloud | 50 | 70.2 | 70.2 | 100.0 | 122.5 | 2/2/17/24 | 2/3 | FAIL | crawl 70.2 > 80% cap (40.0); walkA 70.2 > 103% cap; walkB 100.0 > 103% cap; crawl === walkA sources |
| 17 | Identity 5 · no budget | — | 2.3 | 2.3 | 2.3 | 2.3 | 4/4/4/4 | 1/3 | FAIL | crawl/walkA/walkB identical source sets; all three paths same GB and same sources |
| 18 | Network 6 · $100k cloud | 100 | 106.9 | 106.9 | 199.6 | 246.1 | 3/3/17/28 | 2/3 | FAIL | crawl 106.9 > 80% cap (80.0); walkA 106.9 > 103% cap; walkB 199.6 > 103% cap; crawl === walkA sources |
| 19 | Network 6 · $50k cloud | 50 | 74.5 | 74.5 | 99.9 | 124.4 | 3/3/10/15 | 2/3 | FAIL | crawl 74.5 > 80% cap (40.0); walkA 74.5 > 103% cap; walkB 99.9 > 103% cap; crawl === walkA sources |
| 20 | Network 6 · no budget | — | 240.3 | 240.3 | 240.3 | 240.3 | 4/4/4/4 | 1/3 | FAIL | crawl/walkA/walkB identical source sets; all three paths same GB and same sources |
| 21 | Minimal 3 · $100k cloud | 100 | 74.3 | 98.3 | 86.3 | 200.0 | 11/13/12/23 | 3/3 | PASS | — |
| 22 | Minimal 3 · $50k cloud | 50 | 36.7 | 50.1 | 44.7 | 99.7 | 8/10/9/23 | 3/3 | PASS | — |
| 23 | Minimal 3 · no budget | — | 6.5 | 6.5 | 6.5 | 6.5 | 3/3/3/3 | 1/3 | FAIL | crawl/walkA/walkB identical source sets; all three paths same GB and same sources |
| 24 | Core 8 · $100k cloud | 100 | 78.9 | 98.8 | 86.8 | 200.0 | 13/13/12/26 | 3/3 | PASS | — |
| 25 | Core 8 · $50k cloud | 50 | 39.0 | 50.4 | 43.4 | 99.8 | 13/15/14/24 | 3/3 | PASS | — |
| 26 | Core 8 · no budget | — | 9.1 | 9.6 | 9.6 | 9.6 | 6/7/7/7 | 2/3 | FAIL | walkA === walkB sources |
| 27 | Core 12 · $100k cloud | 100 | 72.9 | 97.9 | 101.4 | 198.3 | 13/16/16/29 | 3/3 | PASS | — |
| 28 | Core 12 · $50k cloud | 50 | 34.2 | 50.5 | 43.7 | 99.2 | 14/17/16/26 | 3/3 | PASS | — |
| 29 | Core 12 · no budget | — | 8.1 | 10.8 | 10.8 | 10.8 | 6/9/9/9 | 2/3 | FAIL | walkA === walkB sources |
| 30 | Foundational only · 10 src · $100k | 100 | 74.0 | 98.0 | 86.0 | 200.0 | 17/19/18/27 | 3/3 | PASS | — |
| 31 | Enterprise primary · Marion · $150k | 150 | 113.1 | 147.8 | 147.8 | 300.0 | 18/25/26/21 | 3/3 | PASS | — |
| 32 | Single UC threat · 8 src · $100k | 100 | 69.0 | 99.3 | 98.8 | 197.0 | 11/14/13/30 | 3/3 | PASS | — |
| 33 | Future-heavy · $100k cloud | 100 | 72.5 | 97.7 | 96.5 | 198.8 | 12/15/14/16 | 3/3 | PASS | — |
| 34 | Tiny 2-src · $30k cloud | 30 | 43.0 | 43.0 | 59.7 | 74.7 | 3/3/9/12 | 2/3 | FAIL | crawl 43.0 > 80% cap (24.0); walkA 43.0 > 103% cap; walkB 59.7 > 103% cap; crawl === walkA sources |
| 35 | Large synthetic 16 · $500k cloud | 500 | 341.7 | 489.6 | 497.7 | 995.7 | 46/31/36/52 | 3/3 | PASS | — |
| 36 | Low budget $40k · Marion | 40 | 30.3 | 38.9 | 40.8 | 79.3 | 10/16/12/16 | 3/3 | PASS | — |
| 37 | High budget $1M · Marion | 1000 | 748.0 | 982.0 | 976.0 | 1648.0 | 49/46/48/51 | 3/3 | PASS | — |
| 38 | Marion · $75k cloud | 75 | 53.3 | 73.1 | 75.8 | 149.1 | 10/17/12/17 | 3/3 | PASS | — |
| 39 | Marion · $125k cloud | 125 | 91.1 | 125.2 | 125.4 | 250.0 | 17/19/23/31 | 3/3 | PASS | — |
| 40 | Marion · $250k cloud | 250 | 173.4 | 245.7 | 248.8 | 496.0 | 27/26/12/38 | 3/3 | PASS | — |
| 41 | Marion · $42.5k onprem | 65 | 47.0 | 65.3 | 66.0 | 130.7 | 10/12/12/15 | 3/3 | PASS | — |
| 42 | Marion · $97.5k onprem | 150 | 103.1 | 149.2 | 146.4 | 299.9 | 18/21/23/15 | 3/3 | PASS | — |
| 43 | Mix 1 · $100k | 100 | 74.6 | 98.6 | 86.6 | 199.1 | 12/14/13/25 | 3/3 | PASS | — |
| 44 | Mix 2 · $100k | 100 | 104.7 | 104.7 | 199.9 | 249.4 | 2/2/19/28 | 2/3 | FAIL | crawl 104.7 > 80% cap (80.0); walkA 104.7 > 103% cap; walkB 199.9 > 103% cap; crawl === walkA sources |
| 45 | Mix 3 · $100k | 100 | 74.0 | 98.7 | 98.5 | 198.0 | 7/12/11/33 | 3/3 | PASS | — |
| 46 | Mix 4 · $100k | 100 | 69.2 | 98.0 | 96.8 | 197.7 | 12/16/15/23 | 3/3 | PASS | — |
| 47 | Mix 5 · $100k | 100 | 75.4 | 99.2 | 98.3 | 200.0 | 5/10/10/32 | 3/3 | PASS | — |
