import time
from pathlib import Path

import httpx

USER_AGENT = "LegalPipeline-Parser/1.0"
PAUSE_BETWEEN_REQUESTS_S = 1.0
TIMEOUT_S = 30.0
CONNECT_RETRIES = 3
IPV4_ANY_ADDRESS = "0.0.0.0"


class HttpxDownloader:
    def __init__(
        self,
        user_agent: str = USER_AGENT,
        pause_s: float = PAUSE_BETWEEN_REQUESTS_S,
        timeout_s: float = TIMEOUT_S,
        retries: int = CONNECT_RETRIES,
    ):
        transport = httpx.HTTPTransport(local_address=IPV4_ANY_ADDRESS, retries=retries)
        self._client = httpx.Client(
            transport=transport,
            headers={"User-Agent": user_agent},
            timeout=timeout_s,
            follow_redirects=True,
        )
        self._pause_s = pause_s
        self._last_request_at = 0.0

    def download(self, url: str, dest: Path) -> Path:
        wait_s = self._last_request_at + self._pause_s - time.monotonic()
        if wait_s > 0:
            time.sleep(wait_s)

        response = self._client.get(url)
        self._last_request_at = time.monotonic()
        response.raise_for_status()

        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(response.content)
        return dest
