# Dify response troubleshooting

The browser expects the published Dify Chatflow to return a JSON object from its Answer node.

The current DSL's Answer node is:

```text
{{#gakku-engine.response_json#}}
```

If `/api/chat` reports `Dify answer was not valid frontend JSON`, first read the raw Dify answer included in the error. Common causes are:

1. `DIFY_API_KEY` belongs to a different Dify app. App API keys are app-specific.
2. The imported Chatflow was edited but not published after the change.
3. The Answer node contains extra prose or Markdown instead of only `response_json`.
4. A Dify node failed and the app returned a human-readable fallback message.

The proxy deliberately does not simulate a local response. It accepts raw JSON, a Markdown-fenced JSON object, or a once-double-encoded JSON string so formatting noise does not hide the actual contract issue.
