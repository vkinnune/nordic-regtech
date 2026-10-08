from pathlib import Path
from typing import Protocol


class Downloader(Protocol):
    def download(self, url: str, dest: Path) -> Path: ...
