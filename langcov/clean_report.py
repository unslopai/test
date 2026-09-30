"""Summarise order totals per customer."""
from collections import defaultdict


def totals_by_customer(orders: list[tuple[str, float]]) -> dict[str, float]:
    """Return the summed order amount for each customer id."""
    totals: dict[str, float] = defaultdict(float)
    for customer_id, amount in orders:
        totals[customer_id] += amount
    return dict(totals)
