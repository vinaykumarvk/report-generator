"""
Lightweight reporting pipeline primitives.

This package provides basic building blocks for assembling report-generation
profiles and stages. It is intentionally minimal and focused on supplying the
structures needed for tests in this repository.
"""

from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)

__all__ = [
    "pipeline",
    "prompts",
    "adapters",
    "profiles",
    "cache",
    "dashboard",
    "models",
    "retrieval",
    "scoring",
]
