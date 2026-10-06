# oracle-config-check: examples/good/oracles.json

- File: 209 lines, 5,278 bytes
- Protocol: Harbor Example Lending; 7 assets on 4 networks \(ethereum, arbitrum, base and linea\); 5 used as collateral
- Findings: 1 \(1 info\)
- Result: **PASS - no finding at or above error \(1 info\)**

## Findings

| Level | Check | Where | Message |
| --- | --- | --- | --- |
| info | network-not-in-table | examples/good/oracles.json:187 | The network "linea" of asset LINK on linea is not in the tool's table \(ethereum, polygon, bnb, avalanche, gnosis, arbitrum, base, celo, mantle, megaeth, metis, optimism, scroll, soneium, x-layer, zksync\), so whether it runs a sequencer that needs an uptime check was not judged. This is a best practice of this tool, not a rule in the Chainlink pages on Data Feeds or on ethereum.org. Fix: Check by hand whether the network runs a sequencer and how the protocol learns that it is down, or name the network as the table does \(docs/inputs.md\). |

## Assets (7)

| Asset | Network | Role | Feed | Fallback | Heartbeat | Max age | Decimals | Scale | Sequencer | Bounds |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| WETH | ethereum | both | chainlink | twap | 3600s | 3780s | 8 | 8 | - | 100..100000 |
| WBTC | ethereum | collateral | chainlink | chainlink | 86400s | 90720s | 8 | feed | - | 1000..1000000 |
| USDC | ethereum | both | chainlink | twap | 86400s | 90720s | 8 | 8 | - | 0.5..1.05 |
| WETH | arbitrum | collateral | chainlink | twap | 86400s | 90720s | 8 | 8 | on, 3600s | 100..100000 |
| ARB | arbitrum | borrowable | chainlink | - | 86400s | 90720s | 8 | 8 | on, 3600s | 0.01..100 |
| WETH | base | collateral | chainlink | twap | 1200s | 1260s | 8 | 8 | on, 3600s | 100..100000 |
| LINK | linea | borrowable | chainlink | - | 86400s | 90720s | 8 | 8 | - | 0.5..1000 |

This report is an input to a review before the protocol is deployed: not a security audit and not a guarantee that the oracle of the protocol cannot be manipulated or fail.
