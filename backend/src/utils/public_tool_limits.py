import re
from typing import Iterable

MAX_INDEX_BATCH_KEYS = 6
MAX_DOCKER_REPO_LENGTH = 128
MAX_DOCKER_TAG_LENGTH = 128
MAX_DOCKER_QUERY_LENGTH = 64

_DOCKER_REPO_RE = re.compile(
    r"^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)?$"
)
_DOCKER_TAG_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")
_DOCKER_QUERY_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,63}$")


def valid_index_key(key: str, country_keys: Iterable[str], valid_us_state) -> bool:
    value = str(key or "").strip()
    if not value or len(value) > 80:
        return False
    if value in country_keys:
        return True
    return value.startswith("countries.usa.") and valid_us_state(value)


def valid_docker_repo(value: str) -> bool:
    repo = str(value or "").strip().lower()
    return 1 < len(repo) <= MAX_DOCKER_REPO_LENGTH and bool(_DOCKER_REPO_RE.fullmatch(repo))


def valid_docker_tag(value: str) -> bool:
    tag = str(value or "").strip()
    return 0 < len(tag) <= MAX_DOCKER_TAG_LENGTH and bool(_DOCKER_TAG_RE.fullmatch(tag))


def valid_docker_query(value: str) -> bool:
    query = str(value or "").strip().lower()
    return 0 < len(query) <= MAX_DOCKER_QUERY_LENGTH and bool(_DOCKER_QUERY_RE.fullmatch(query))
