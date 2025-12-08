#encoding=utf8

from urllib.parse import urlparse, urlunparse
import importlib

from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.core.exceptions import ImproperlyConfigured
from django.http import QueryDict


def load_object(path):
    """Import object from string path: 'package.module.ClassName'."""
    try:
        module_path, attr_name = path.rsplit('.', 1)
        module = importlib.import_module(module_path)
        return getattr(module, attr_name)
    except (ValueError, ImportError, AttributeError) as e:
        raise ImproperlyConfigured(f"Error importing {path}: {e}")


def get_login_url(next, login_url=None,
                      redirect_field_name=REDIRECT_FIELD_NAME):
    """Returns the full login_url with next parameter set."""
    if not login_url:
        login_url = settings.LOGIN_URL

    login_url_parts = list(urlparse(login_url))
    if redirect_field_name:
        querystring = QueryDict(login_url_parts[4], mutable=True)
        querystring[redirect_field_name] = next
        login_url_parts[4] = querystring.urlencode(safe='/')

    return urlunparse(login_url_parts)


def get_test_user_function():
    """
    Returns the function set on settings.CHATROOMS_TEST_USER_FUNCTION
    if any, else returns False.
    """
    if hasattr(settings, 'CHATROOMS_TEST_USER_FUNCTION'):
        return load_object(settings.CHATROOMS_TEST_USER_FUNCTION)
    return False


test_user_function = get_test_user_function()


def check_user_passes_test(request, user):
    """Returns the test_user_function result if any, else True."""
    if test_user_function:
        return test_user_function(request, user)
    return True