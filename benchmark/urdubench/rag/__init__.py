"""Offline RAG baseline: Urdu Wikipedia corpus, chunking, Gemini embeddings, retrieval, evaluation.

The same embedding model and settings (gemini-embedding-001, 768 dimensions, L2-normalized) are used
here and in the live `/api/ask` route, so offline and live retrieval agree.
"""

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIMS = 768
