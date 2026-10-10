import argparse
import sys
from datetime import date
from pathlib import Path

import httpx
from pydantic import TypeAdapter

from regtech import linker, pipeline
from regtech.citations.regex_extractor import RegexExtractor
from regtech.document_numbers import NUMBER_RE
from regtech.download.base import Downloader
from regtech.download.httpx_downloader import HttpxDownloader
from regtech.download.offline_downloader import OfflineDownloader
from regtech.models import LegalDocument
from regtech.pdf.pymupdf_reader import PyMuPdfReader
from regtech.sources.base import Source
from regtech.sources.fffs import FffsSource
from regtech.sources.riksdagen import RiksdagenSource
from regtech.storage.sqlite_storage import SqliteStorage

DEFAULT_DATA_DIR = Path("data")
DB_NAME = "regtech.db"
RAW_DIR_NAME = "raw"
DEFAULT_PORT = 8000
VIEWER_HOST = "0.0.0.0"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="regtech")
    commands = parser.add_subparsers(dest="command", required=True)

    fetch = commands.add_parser(
        "fetch",
        help="download and parse SFS Acts and Ordinances (Riksdagen) or FFFS regulations (fi.se)",
    )
    fetch.add_argument("source", choices=SOURCES)
    picks = fetch.add_mutually_exclusive_group()
    picks.add_argument(
        "--number",
        type=_number,
        action="append",
        help="number such as 2007:528; repeat the flag for several documents "
        "(without it, fffs gets the whole register)",
    )
    picks.add_argument(
        "--all",
        action="store_true",
        help="sfs: every Ministry of Finance statute in force; fffs: the whole register",
    )
    picks.add_argument(
        "--since",
        type=_day,
        help="sfs: Ministry of Finance statutes changed on or after this day (YYYY-MM-DD)",
    )
    fetch.add_argument(
        "--offline", action="store_true", help="parse earlier downloads again, download nothing"
    )
    fetch.add_argument("--limit", type=_positive_int, help="only the first N items")

    commands.add_parser("link", help="resolve citations between all stored documents")

    serve = commands.add_parser("serve", help="start the browser viewer")
    serve.add_argument(
        "--host", default=VIEWER_HOST, help=f"address to listen on (default: {VIEWER_HOST})"
    )
    serve.add_argument("--port", type=int, default=DEFAULT_PORT)

    for command in commands.choices.values():
        command.add_argument(
            "--data-dir",
            type=Path,
            default=DEFAULT_DATA_DIR,
            help="where downloads, JSON files and the database go (default: data)",
        )

    args = parser.parse_args(argv)
    handlers = {"fetch": _fetch, "link": _link, "serve": _serve}
    try:
        return handlers[args.command](args)
    except (LookupError, FileNotFoundError, RuntimeError, ValueError, httpx.HTTPError) as error:
        print(f"regtech: {error}", file=sys.stderr)
        return 1


def _sfs_source(
    args: argparse.Namespace, downloader: Downloader, raw_base: Path, storage: SqliteStorage
) -> Source:
    if args.number is None and not args.all and args.since is None:
        raise ValueError("fetch sfs needs --number, --all or --since")

    raw_dir = raw_base / RiksdagenSource.name
    stored_ids = {
        summary.id for summary in storage.list_documents() if summary.source == RiksdagenSource.name
    }
    return RiksdagenSource(
        args.number, downloader, raw_dir, RegexExtractor(), args.since, stored_ids
    )


def _fffs_source(
    args: argparse.Namespace, downloader: Downloader, raw_base: Path, storage: SqliteStorage
) -> Source:
    if args.since is not None:
        raise ValueError("--since is for fetch sfs only")

    raw_dir = raw_base / FffsSource.name
    return FffsSource(args.number, downloader, PyMuPdfReader(), raw_dir, RegexExtractor())


SOURCES = {"sfs": _sfs_source, "fffs": _fffs_source}


def _fetch(args: argparse.Namespace) -> int:
    downloader = OfflineDownloader() if args.offline else HttpxDownloader()
    storage = SqliteStorage(args.data_dir / DB_NAME)
    source = SOURCES[args.source](args, downloader, args.data_dir / RAW_DIR_NAME, storage)

    json_dir = args.data_dir / "json" / source.name
    # Riksdagen marks repealed laws itself; its list leaves out laws of other ministries.
    mark_unlisted = args.source == "fffs" and args.limit is None and args.number is None
    # Saved downloads parsed again differ from the stored version only where the parser changed.
    compare_versions = not args.offline
    docs, failures = pipeline.run(
        source, storage, storage, json_dir, args.limit, mark_unlisted, compare_versions
    )

    sys.stdout.buffer.write(TypeAdapter(list[LegalDocument]).dump_json(docs, indent=2) + b"\n")

    for failure in failures:
        print(f"regtech: {failure}", file=sys.stderr)
    return 1 if failures else 0


def _link(args: argparse.Namespace) -> int:
    storage = SqliteStorage(args.data_dir / DB_NAME)
    link_count, missing = linker.link(storage, storage)

    print(f"{link_count} links stored.")
    if missing:
        print("Cited but not stored (document: citations):")
        for identifier, count in missing.most_common():
            print(f"  {identifier}: {count}")
    return 0


def _serve(args: argparse.Namespace) -> int:
    import uvicorn

    from regtech.viewer.app import create_app

    storage = SqliteStorage(args.data_dir / DB_NAME)
    app = create_app(storage, storage, storage, args.data_dir / RAW_DIR_NAME)
    print(f"Viewer at http://{args.host}:{args.port}/ (Ctrl+C stops it)")
    uvicorn.run(app, host=args.host, port=args.port)
    return 0


def _number(value: str) -> str:
    if not NUMBER_RE.match(value):
        raise argparse.ArgumentTypeError(f"not a number like 2007:528: {value}")
    return value


def _day(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a day like 2026-10-01: {value}") from None


def _positive_int(value: str) -> int:
    if not value.isdigit() or int(value) == 0:
        raise argparse.ArgumentTypeError(f"not a positive whole number: {value}")
    return int(value)
