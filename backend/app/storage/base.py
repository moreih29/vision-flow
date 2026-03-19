from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    async def save(self, key: str, data: bytes) -> str:
        """Save data and return the storage key/path."""
        ...

    @abstractmethod
    async def load(self, key: str) -> bytes:
        """Load and return data by key."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete data by key."""
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if data exists for the given key."""
        ...
