from abc import ABC, abstractmethod
from pathlib import Path


class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    async def save(self, key: str, data: bytes) -> str:
        """Save data and return the storage key/path."""
        ...

    @abstractmethod
    async def save_from_path(self, key: str, src_path: Path) -> str:
        """Move/copy a temporary file into storage and return the storage key/path.

        Implementations should prefer atomic move over copy to avoid doubling memory or I/O.
        """
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

    @abstractmethod
    def get_file_path(self, key: str) -> str:
        """Return the filesystem path for the given key (for FileResponse etc.).

        Only meaningful for local-file backends. Raises NotImplementedError for
        object-storage backends (e.g. S3) where there is no local path.
        """
        ...
