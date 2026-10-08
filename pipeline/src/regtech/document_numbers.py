import re

SFS_NUMBER_RE = re.compile(r"^\d{4}:\d+$")
FFFS_NUMBER = r"FFFS\s+(\d{4}:\d+)"
FFFS_NUMBER_RE = re.compile(FFFS_NUMBER)
