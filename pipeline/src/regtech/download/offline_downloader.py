from pathlib import Path


class OfflineDownloader:
    def download(self, url: str, dest: Path, headers: dict[str, str] | None = None) -> Path:
        if not dest.exists():
            raise FileNotFoundError(f"not downloaded yet: {url} (expected at {dest})")
        return dest
