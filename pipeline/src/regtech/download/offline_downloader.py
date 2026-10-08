from pathlib import Path


class OfflineDownloader:
    def download(self, url: str, dest: Path) -> Path:
        if not dest.exists():
            raise FileNotFoundError(f"not downloaded yet: {url} (expected at {dest})")
        return dest
