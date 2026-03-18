"""
Core AI abstraction layer entrypoints.

This package exposes memoized factory helpers that return the configured
LLM and embeddings clients so route handlers can remain provider-agnostic.
"""

from .llm_client import get_llm_client, LLMClient  # noqa: F401
from .embeddings_client import get_embeddings_client, EmbeddingsClient  # noqa: F401

