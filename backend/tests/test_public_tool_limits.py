import unittest

from src.utils.public_tool_limits import (
    MAX_INDEX_BATCH_KEYS,
    valid_docker_query,
    valid_docker_repo,
    valid_docker_tag,
    valid_index_key,
)


class PublicToolLimitTests(unittest.TestCase):
    def test_index_keys_are_allowlisted_or_validated_us_states(self):
        countries = {"countries.romania", "countries.uzbekistan"}
        us_state = lambda value: value == "countries.usa.ca"

        self.assertTrue(valid_index_key("countries.romania", countries, us_state))
        self.assertTrue(valid_index_key("countries.usa.ca", countries, us_state))
        self.assertFalse(valid_index_key("countries.usa.zz", countries, us_state))
        self.assertFalse(valid_index_key("arbitrary-cache-key", countries, us_state))

    def test_index_batch_limit_stays_small(self):
        self.assertLessEqual(MAX_INDEX_BATCH_KEYS, 8)

    def test_docker_repository_validation_accepts_normal_names_only(self):
        self.assertTrue(valid_docker_repo("library/node"))
        self.assertTrue(valid_docker_repo("amonemisa/personal-site"))
        self.assertFalse(valid_docker_repo("https://example.com/repo"))
        self.assertFalse(valid_docker_repo("../registry"))
        self.assertFalse(valid_docker_repo("UPPER/Name"))

    def test_docker_tag_and_query_validation_bound_cardinality_inputs(self):
        self.assertTrue(valid_docker_tag("24-alpine3.22"))
        self.assertTrue(valid_docker_query("alpine"))
        self.assertFalse(valid_docker_tag("bad/tag"))
        self.assertFalse(valid_docker_query("a" * 65))
        self.assertFalse(valid_docker_query("alpine?page=all"))


if __name__ == "__main__":
    unittest.main()
