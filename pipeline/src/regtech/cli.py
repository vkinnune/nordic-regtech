import argparse
import sys
from pathlib import Path

import httpx
from pydantic import TypeAdapter

from regtech import linker, pipeline
from regtech.citations.regex_extractor import RegexExtractor
from regtech.document_numbers import SFS_NUMBER_RE
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
DEFAULT_PORT = 8000
VIEWER_HOST = "127.0.0.1"

FINANCIAL_PRESETS: dict[str, list[str]] = {
    "financial": [
        "2007:528",  # Lag om värdepappersmarknaden (MiFID II)
        "2007:572",  # Förordning om värdepappersmarknaden
        "2017:630",  # Lag om åtgärder mot penningtvätt (AML)
        "2018:1219", # Lag om försäkringsdistribution (IDD)
        "2004:297",  # Lag om bank- och finansieringsrörelse
        "2004:329",  # Förordning om bank- och finansieringsrörelse
        "2013:561",  # Lag om förvaltare av alternativa investeringsfonder (AIFM)
        "2004:46",   # Lag om värdepappersfonder (UCITS)
        "2010:751",  # Lag om betaltjänster (PSD2)
        "2010:2043", # Försäkringsrörelselag
        "2014:968",  # Lag om särskild tillsyn över kreditinstitut och värdepappersbolag
        "2015:1016", # Lag om resolution
        "2015:1017", # Lag om förebyggande statligt stöd till kreditinstitut
        "1995:1571", # Lag om insättningsgaranti
        "1999:158",  # Lag om investerarskydd
        "2016:1306", # Marknadsmissbruksförordningens kompletteringslag (MAR)
        "2019:742",  # Lag om tjänstepensionsföretag (IORP II)
    ],
    "banking": ["2004:297", "2004:329", "2014:968", "2015:1016", "1995:1571"],
    "funds": ["2004:46", "2013:561", "2019:742"],
    "aml": ["2017:630"],
    "insurance": ["2010:2043", "2018:1219"],
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="regtech")
    commands = parser.add_subparsers(dest="command", required=True)

    fetch_sfs = commands.add_parser(
        "fetch-sfs", help="download and parse Acts and Ordinances from Riksdagen"
    )
    fetch_sfs.add_argument(
        "--number",
        type=_sfs_number,
        action="append",
        help="SFS number such as 2007:528; repeat the flag for several laws",
    )
    fetch_sfs.add_argument(
        "--preset",
        choices=list(FINANCIAL_PRESETS.keys()),
        help="fetch a predefined collection of Swedish financial laws",
    )
    _add_download_flags(fetch_sfs)

    crawl_fffs = commands.add_parser(
        "crawl-fffs", help="download and parse all active FFFS regulations from fi.se"
    )
    _add_download_flags(crawl_fffs)

    commands.add_parser("link", help="resolve citations between all stored documents")

    serve = commands.add_parser("serve", help="start the browser viewer")
    serve.add_argument("--host", default="0.0.0.0", help="host to listen on (default: 0.0.0.0)")
    serve.add_argument("--port", type=int, default=DEFAULT_PORT)

    for command in commands.choices.values():
        command.add_argument(
            "--data-dir",
            type=Path,
            default=DEFAULT_DATA_DIR,
            help="where downloads, JSON files and the database go (default: data)",
        )

    args = parser.parse_args(argv)
    handlers = {"fetch-sfs": _fetch_sfs, "crawl-fffs": _crawl_fffs, "link": _link, "serve": _serve}
    try:
        return handlers[args.command](args)
    except (LookupError, FileNotFoundError, RuntimeError, ValueError, httpx.HTTPError) as error:
        print(f"regtech: {error}", file=sys.stderr)
        return 1


def _add_download_flags(command: argparse.ArgumentParser) -> None:
    command.add_argument(
        "--offline", action="store_true", help="parse earlier downloads again, download nothing"
    )
    command.add_argument("--limit", type=_positive_int, help="only the first N items")


def _fetch_sfs(args: argparse.Namespace) -> int:
    numbers: list[str] = list(args.number or [])
    if args.preset:
        for num in FINANCIAL_PRESETS.get(args.preset, []):
            if num not in numbers:
                numbers.append(num)
    if not numbers:
        print("regtech: either --number or --preset must be provided", file=sys.stderr)
        return 2

    downloader = OfflineDownloader() if args.offline else HttpxDownloader()
    raw_dir = args.data_dir / "raw" / RiksdagenSource.name
    source = RiksdagenSource(numbers, downloader, raw_dir, RegexExtractor())
    docs, failures = _run_source(source, args)

    sys.stdout.buffer.write(TypeAdapter(list[LegalDocument]).dump_json(docs, indent=2) + b"\n")
    return _report(failures)


def _crawl_fffs(args: argparse.Namespace) -> int:
    downloader = OfflineDownloader() if args.offline else HttpxDownloader()
    raw_dir = args.data_dir / "raw" / FffsSource.name
    source = FffsSource(downloader, PyMuPdfReader(), raw_dir, RegexExtractor())
    _, failures = _run_source(source, args, remove_unlisted=args.limit is None)

    return _report(failures)


def _run_source(
    source: Source, args: argparse.Namespace, remove_unlisted: bool = False
) -> tuple[list[LegalDocument], list[str]]:
    storage = SqliteStorage(args.data_dir / DB_NAME)
    json_dir = args.data_dir / "json" / source.name
    return pipeline.run(source, storage, json_dir, args.limit, remove_unlisted)


def _report(failures: list[str]) -> int:
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
    app = create_app(storage, storage)
    print(f"Viewer at http://{args.host}:{args.port}/ (Ctrl+C stops it)")
    uvicorn.run(app, host=args.host, port=args.port)
    return 0


def _sfs_number(value: str) -> str:
    if not SFS_NUMBER_RE.match(value):
        raise argparse.ArgumentTypeError(f"not an SFS number like 2007:528: {value}")
    return value


def _positive_int(value: str) -> int:
    if not value.isdigit() or int(value) == 0:
        raise argparse.ArgumentTypeError(f"not a positive whole number: {value}")
    return int(value)
