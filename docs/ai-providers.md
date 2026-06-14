# AI Provider Configuration Guide — Qanunora

## Supported Providers

| Provider | Key Env Var | Model Env Var | Default Model |
|----------|------------|---------------|---------------|
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-4o` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_DEPLOYMENT` | — |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| Google Gemini | `GOOGLE_AI_API_KEY` | `GEMINI_MODEL` | `gemini-1.5-pro` |
| Mistral | `MISTRAL_API_KEY` | `MISTRAL_MODEL` | `mistral-large-latest` |
| Cohere | `COHERE_API_KEY` | `COHERE_MODEL` | `command-r-plus` |
| Groq | `GROQ_API_KEY` | `GROQ_MODEL` | `llama-3.1-70b-versatile` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | `deepseek-chat` |
| Together AI | `TOGETHER_API_KEY` | `TOGETHER_MODEL` | `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` |
| Ollama | _(none)_ | `OLLAMA_MODEL` | `llama3.1` |
| Custom Endpoint | `CUSTOM_AI_API_KEY` | `CUSTOM_AI_MODEL` | — |

## Choosing a Provider

**For legislative analysis (recommended):**
- **Anthropic Claude** (`claude-sonnet-4-6`) — best instruction following, excellent at structured JSON output, strong at legal reasoning
- **OpenAI GPT-4o** — solid all-around, best ecosystem support
- **Google Gemini 1.5 Pro** — large context window (useful for long draft laws)

**For fast/cheap operations (summaries of short items):**
- **Groq + Llama 3.1 70B** — very fast inference, good quality
- **Together AI** — cost-effective at scale

**For air-gapped / offline deployment:**
- **Ollama** — runs locally, no external API calls
- Set `OLLAMA_BASE_URL=http://localhost:11434` and choose an appropriate model

## Setting the Default Provider

```bash
AI_DEFAULT_PROVIDER=anthropic
```

## Provider API: Switching Per Request

Every AI feature endpoint accepts an optional `provider` field:

```json
POST /api/v1/legislative-items/:id/summaries
{
  "summaryType": "EXECUTIVE",
  "provider": "anthropic"
}
```

If omitted, the `AI_DEFAULT_PROVIDER` is used.

## Azure OpenAI Setup

```bash
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o          # Your deployment name
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

## OpenAI-Compatible Custom Endpoint

For providers that expose an OpenAI-compatible API (vLLM, LocalAI, LM Studio, Anyscale, etc.):

```bash
CUSTOM_AI_BASE_URL=http://localhost:8080/v1
CUSTOM_AI_API_KEY=your-key-or-empty
CUSTOM_AI_MODEL=your-model-name
AI_DEFAULT_PROVIDER=openai-compatible
```

## AI Safety Requirements

All AI features in Qanunora enforce:

1. **Structured JSON output** — all results are parsed into typed schemas
2. **Confidence scores** — returned with every analysis (0.0–1.0)
3. **Source references** — RAG responses include document citations
4. **Legal disclaimer** — "AI-assisted analysis, not legal advice" on every result
5. **Human review flag** — `reviewedByHuman: false` until a human approves
6. **No autonomous approvals** — AI can recommend, never approve

## Testing Provider Connectivity

```bash
# Check registered providers
GET /api/v1/ai-providers

# Test a specific provider
POST /api/v1/ai-providers/test
{"provider": "anthropic"}
```

## Embedding Provider (Semantic Search)

Semantic search uses OpenAI `text-embedding-3-small` by default:

```bash
OPENAI_API_KEY=sk-...   # Same key as text generation
```

If `OPENAI_API_KEY` is not set, the embedding provider falls back to a zero-vector stub — semantic search will still work but return random rankings. Always set the key for production.
