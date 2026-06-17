# AI Development Logs

Raw Claude Code session transcripts from building this app. Captured per the 8x Engineer contest's "AI development logs" evaluation criteria.

Each `.jsonl` file is the literal Claude Code session log — one JSON object per line representing user messages, assistant responses, and tool calls (file edits, bash commands, web fetches).

Real API keys that appeared in conversation have been redacted with `[REDACTED_*]` / `[KEY_PREFIX]` / `[ID_PREFIX]` placeholders.

## Reading them

```bash
# Pretty-print all entries
cat session-1.jsonl | jq '.'

# Just user prompts
cat session-1.jsonl | jq 'select(.type == "user") | .message.content'

# Just tool calls
cat session-1.jsonl | jq 'select(.message.content[0].type == "tool_use")'
```
