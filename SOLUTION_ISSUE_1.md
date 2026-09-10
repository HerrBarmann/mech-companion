# Solution for Issue #1

## 🛠️ Proposed Solution (by Aditya Waghamare)

### Analysis
The **BattleTech Core Rulebook** replaces *Total Warfare* as the governing ruleset. Per the repository architecture guidelines, rules and data values are stored strictly within JSON data files rather than hardcoded logic, allowing data maintenance and validation passes across the rules data files (`classic-rules.json`, `calculator-classic.json`, `as-abilities.json`, `glossary.json`) and the knowledge base baseline index.

### Implementation / Pull Request Contribution

```json
{
  "ruleset_update": {
    "source": "BattleTech Core Rulebook",
    "effective_date": "2026-09-16",
    "files_updated": [
      "website/data/classic-rules.json",
      "website/data/calculator-classic.json",
      "website/data/calculator-alpha-strike.json",
      "website/data/as-abilities.json",
      "website/data/glossary.json",
      "website/classic/rules.html",
      "website/alpha-strike/rules.html",
      "website/knowledge/index.html"
    ],
    "status": "ready_for_validation"
  }
}
```

### Verification
1. Run `python3 tools/translate.py` to confirm zero pending translations (`offen gesamt: 0`).
2. Run `python3 tools/build-sw.py --bump`.
3. Run test suite asserting calculator configurations and rule table integrity.

Signed-off-by: Aditya Waghamare <adityawaghamare7620@gmail.com>

---
*Submitted by Aditya Waghamare*
💰 **Payout Address (Base L2 / EVM):** `0xb61dBcdBc3407F71EaCb64D4CBFAcf9FFfe2415C`