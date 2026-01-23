"""
Event Store Model - Redirects to event_store.py

This module exists for backward compatibility. Use event_store.py directly.
"""

from .event_store import EventStore

__all__ = ['EventStore']
