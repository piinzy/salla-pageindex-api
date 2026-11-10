"""Read bounded XLSX workbooks for merchant review before saving any drafts."""
import base64
from io import BytesIO
from zipfile import ZipFile
from openpyxl import load_workbook


def sheet_values(sheet):
    sheet.reset_dimensions()
    rows = []
    for position, cells in enumerate(sheet.iter_rows()):
        if position >= 2048:
            raise ValueError("انقل الجدول إلى بداية الورقة واحذف الفراغات الزائدة.")
        if not cells:
            continue
        values = []
        for cell in cells:
            if cell.value is None:
                values.append('')
                continue
            if cell.data_type in ('f', 'e'):
                raise ValueError('حوّل الصيغ والأخطاء إلى قيم قبل الرفع.')
            if len(values) >= 11:
                raise ValueError('الحد ١٠ أعمدة قياس بالإضافة إلى المقاس.')
            values.append(str(cell.value).strip())
        while values and not values[-1]:
            values.pop()
        if values:
            rows.append(values)
        if len(rows) > 31:
            raise ValueError('الحد ٣٠ مقاسًا لكل جدول.')
    if len(rows) < 2 or len(rows[0]) < 2:
        raise ValueError('تحتاج الورقة عناوين وصف مقاس واحد على الأقل.')
    width = len(rows[0])
    if any(not label or len(label)>40 for label in rows[0][1:]) or len(rows[0][0])>20:
        raise ValueError('راجع عناوين الأعمدة قبل الاستيراد.')
    for row in rows[1:]:
        if len(row)>width or not row[0] or len(row[0])>30 or any(len(v)>60 for v in row[1:]):
            raise ValueError('راجع أسماء المقاسات وعناوين الأعمدة وطول الخانات.')
        row.extend(['']*(width-len(row)))
    return rows


def preview_workbook(encoded):
    raw = BytesIO(base64.b64decode(encoded, validate=True))
    with ZipFile(raw) as archive:
        entries = archive.infolist()
        if len(entries)>500 or sum(e.file_size for e in entries)>12_000_000:
            raise ValueError('حجم محتوى الملف أكبر من الحد المسموح.')
    raw.seek(0)
    workbook = load_workbook(raw, read_only=True, keep_links=False)
    try:
        sheets = [s for s in workbook.worksheets if s.sheet_state=='visible']
        if len(sheets)>50:
            raise ValueError('اختر ملفًا يحتوي حتى ٥٠ ورقة ظاهرة.')
        result = []
        for sheet in sheets:
            try:
                result.append({'name':sheet.title, 'rows':sheet_values(sheet)})
            except ValueError as exc:
                result.append({'name':sheet.title, 'error':str(exc)})
        return result
    finally:
        workbook.close()
