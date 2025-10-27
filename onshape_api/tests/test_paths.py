import pytest

from onshape_api.paths.doc_path import DocumentPath, ElementPath, InstancePath


class Paths:
    def __init__(self):
        self.inst_path = InstancePath("1", "2")
        self.same_path = InstancePath("1", "2")
        self.diff_path = InstancePath("1", "5")

        self.doc_path = DocumentPath("1")
        self.element_path = ElementPath("1", "2", "5")


@pytest.fixture
def paths() -> Paths:
    return Paths()


def test_equality(paths):
    # equality
    assert paths.inst_path == paths.same_path
    assert paths.inst_path != paths.diff_path

    # hash invariant: equal objects must have equal hashes
    assert hash(paths.inst_path) == hash(paths.same_path)


def test_membership(paths):
    assert paths.inst_path in [paths.same_path]
    assert paths.inst_path in {paths.same_path}
    assert paths.inst_path not in [paths.diff_path]
    assert paths.inst_path not in {paths.diff_path}


def test_comparisons(paths):
    assert not (paths.inst_path == paths.doc_path)
    assert not (paths.inst_path == paths.element_path)


def test_other_type(paths):
    assert not (paths.inst_path == "not a path")
