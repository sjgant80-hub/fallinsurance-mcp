# @ai-native-solutions/fallinsurance-mcp

MCP (Model Context Protocol) server for FallInsurance — the UK GI broker toolkit. Exposes SDK capabilities as stdio tools + resources for Claude Code, Claude Desktop, or any MCP-compatible client.

## Install

```bash
npm install -g @ai-native-solutions/fallinsurance-mcp
```

## Wire into Claude Code

```bash
claude mcp add fallinsurance -- npx -y @ai-native-solutions/fallinsurance-mcp
```

Or add manually to `~/.config/claude/mcp.json` (or the project `.mcp.json`):

```json
{
  "mcpServers": {
    "fallinsurance": {
      "command": "npx",
      "args": ["-y", "@ai-native-solutions/fallinsurance-mcp"]
    }
  }
}
```

Then restart Claude Code.

## Tools

| Tool | What it does |
|---|---|
| `compute_premium` | Commission, net-to-insurer, total-payable from gross / IPT / fee / commission%. |
| `renewal_flag` | Critical-date bucket (7/14/30/60d ladder) for a renewal date. |
| `pipeline_buckets` | Filter a list of policies into renewal buckets. |
| `can_bind` | Check whether a policy passes the IPID + D&N bind gate. |
| `compile_demands_and_needs` | Compile a full IDD Art 20 / ICOBS 5.2 D&N statement. |
| `compliance_snapshot` | One-shot compliance summary (PI, IDD, SM&CR, CASS 5). |
| `lookup_t0_rule` | Natural-language search across 14 canonical UK broker briefings. |

## Resources

| URI | Payload |
|---|---|
| `fallinsurance://t0-rules` | 14 canonical UK GI-broker briefings (JSON). |
| `fallinsurance://product-classes` | Product classes + labels. |
| `fallinsurance://idd-questions` | IDD D&N questionnaire (5 questions). |
| `fallinsurance://pi-minimums` | MIPRU 3.2.7R minimums + IDD CPD floor. |
| `fallinsurance://fos-limits` | FOS award limits (DISP 3.7.4R). |

## Example prompts

- *"Compute commission on a £2,400 gross premium with 15% commission, 12% IPT, £50 broker fee."*
- *"This policy renews on 2026-08-15 — what's the flag?"*
- *"Explain the CASS 5 client-money rules."*
- *"Compile a D&N statement for a cyber policy — client is a 12-employee accountancy practice."*

## License

MIT.
