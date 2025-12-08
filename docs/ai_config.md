# AI Configuration & Environment Variables

This guide enumerates the runtime configuration needed to boot the upgraded AI microservice and the backend service that calls it.

## `ai-service/` (FastAPI)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AI_PROVIDER` | No | `mock` | Provider identifier. Set to `openai` to use live OpenAI models. |
| `OPENAI_API_KEY` | When `AI_PROVIDER=openai` | none | API key injected into the OpenAI Python SDK. |
| `LLM_MODEL_NAME` | No | `gpt-4o-mini` | Chat-completion model used for summaries + parsing. |
| `LLM_TEMPERATURE` | No | `0.2` | Sampling temperature for the LLM client. |
| `EMBEDDING_MODEL_NAME` | No | `text-embedding-3-small` | Embedding model used for matching/recommendations. |
| `PORT` | No | `8000` | Port the FastAPI app listens on. |
| `ENVIRONMENT` | No | `development` | Included in `/health` for observability. |

> **Local development tip:** leave `AI_PROVIDER=mock` when running tests or CI. The deterministic mock clients avoid external calls while still exercising the flow end-to-end.

## `backend/` (Node/Express)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AI_SERVICE_URL` | Yes | none | Base URL pointing at the FastAPI microservice (`http://localhost:8000`). |
| `MATCH_WEIGHT_*` | No | see `.env.example` | Existing knobs for the legacy matchingService; left untouched for backwards compatibility. |
| `ENABLE_JD_PARSING` | No | `false` | When `true`, `jobController` will call `/ai/parse-jd` to auto-populate skills/metadata during job create/update. |

Set these in `backend/.env` and `ai-service/.env` respectively. Never commit `.env` files or API keys—use your local shell, a secrets manager, or deployment-specific config. Once the env variables above are present the integration tests (`python -m pytest tests` and `npm test`) will run without needing to hit live providers.
