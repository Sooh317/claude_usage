"""Anthropic API pricing table and cost calculation.

Pricing source: https://docs.anthropic.com/en/docs/about-claude/pricing
Rates are per million tokens (MTok).
"""

# (input, output, cache_read, cache_write) per MTok in USD
# Ordered longest-prefix-first for correct matching.
PRICING: dict[str, tuple[float, float, float, float]] = {
    "claude-opus-4-6":     (5.00,  25.00, 0.50,  6.25),
    "claude-opus-4-5":     (5.00,  25.00, 0.50,  6.25),
    "claude-opus-4-1":     (15.00, 75.00, 1.50,  18.75),
    "claude-opus-4-":      (15.00, 75.00, 1.50,  18.75),
    "claude-sonnet-4-5":   (3.00,  15.00, 0.30,  3.75),
    "claude-sonnet-4-":    (3.00,  15.00, 0.30,  3.75),
    "claude-sonnet-3-7":   (3.00,  15.00, 0.30,  3.75),
    "claude-haiku-4-5":    (1.00,  5.00,  0.10,  1.25),
    "claude-haiku-3-5":    (0.80,  4.00,  0.08,  1.00),
    "claude-haiku-3":      (0.25,  1.25,  0.03,  0.30),
}

# Pre-sorted prefixes by length (longest first) for matching
_SORTED_PREFIXES = sorted(PRICING.keys(), key=len, reverse=True)

# Fallback pricing (Sonnet-class) for unknown models
_FALLBACK = (3.00, 15.00, 0.30, 3.75)


def get_pricing(model_id: str) -> tuple[float, float, float, float]:
    """Return (input, output, cache_read, cache_write) per-MTok rates for a model.

    Uses longest-prefix matching against the pricing table.
    Falls back to Sonnet-class pricing for unknown models.
    """
    for prefix in _SORTED_PREFIXES:
        if model_id.startswith(prefix):
            return PRICING[prefix]
    return _FALLBACK


def calculate_cost(
    model_id: str,
    input_tokens: float,
    output_tokens: float,
    cache_read_tokens: float = 0,
    cache_creation_tokens: float = 0,
) -> float:
    """Calculate USD cost for the given token counts.

    Args:
        model_id: Full model identifier (e.g. "claude-sonnet-4-5-20250929").
        input_tokens: Number of input tokens.
        output_tokens: Number of output tokens.
        cache_read_tokens: Number of cache-read tokens.
        cache_creation_tokens: Number of cache-creation (write) tokens.

    Returns:
        Cost in USD.
    """
    inp, out, cr, cw = get_pricing(model_id)
    return (
        input_tokens * inp / 1_000_000
        + output_tokens * out / 1_000_000
        + cache_read_tokens * cr / 1_000_000
        + cache_creation_tokens * cw / 1_000_000
    )
