from pathlib import Path

import aiofiles

from app.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    """Local filesystem storage backend. Key is used directly as relative path."""

    def __init__(self, base_path: str = "./data/storage") -> None:
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _key_to_path(self, key: str) -> Path:
        """Convert a storage key to a filesystem path.

        Key is already sharded (e.g. ab/cd/abcd...hash.jpg).
        """
        path = self.base_path / key
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    async def save(self, key: str, data: bytes) -> str:
        path = self._key_to_path(key)
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)
        return str(path)

    async def load(self, key: str) -> bytes:
        path = self._key_to_path(key)
        if not path.exists():
            raise FileNotFoundError(f"Storage key not found: {key}")
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> None:
        path = self._key_to_path(key)
        if path.exists():
            path.unlink()

    async def exists(self, key: str) -> bool:
        path = self._key_to_path(key)
        return path.exists()
