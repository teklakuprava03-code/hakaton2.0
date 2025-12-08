# xhtml2pdf.py
# Локальная заглушка для xhtml2pdf, чтобы проект работал без реальной PDF-генерации.

class _PisaStub:
    @staticmethod
    def CreatePDF(*args, **kwargs):
        # Здесь могла бы быть генерация PDF, но для хакатона мы её отключаем.
        # Просто имитируем успешный вызов.
        print("Stub xhtml2pdf: PDF generation is disabled in this environment.")
        # В оригинале CreatePDF возвращает объект со свойством err.
        class Result:
            err = False
        return Result()


# То, что импортируется в views: from xhtml2pdf import pisa
pisa = _PisaStub()