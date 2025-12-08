# distutils/version.py
# Локальный суррогат для старого distutils.version.LooseVersion
# Нужен для совместимости Django 3.0.5 с Python 3.12

from packaging.version import Version


class LooseVersion(Version):
    """
    Простейшая реализация LooseVersion на основе packaging.Version.
    Для нужд Django (сравнение версий вроде '3.0.5', '3.2', и т.п.) этого достаточно.
    """
    pass