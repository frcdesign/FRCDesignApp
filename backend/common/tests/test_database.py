from pydantic import ValidationError
import pytest

from backend.common.models import LibraryUserData, UserData


def test_cannot_default():
    # In a perfect world these all all valid, but Pydantic is a bit goofy
    with pytest.raises(ValidationError):
        LibraryUserData.model_validate(None)
        LibraryUserData()

        UserData.model_validate(None)
        UserData()


def test_defaultable():
    """Trivial tests to verify defaulting works as expected."""
    LibraryUserData.model_validate({})
    UserData.model_validate({})
