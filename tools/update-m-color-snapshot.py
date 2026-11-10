#!/usr/bin/env python3
"""Refresh a month's M mapping from a Google Sheets XLSX export.
Usage: python3 tools/update-m-color-snapshot.py export.xlsx 'NOV 26' '10 November 2026 · WIB'
Only orange/black M cells are accepted; unknown colors abort the update.
"""
import calendar
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
DEPARTMENTS = {'TRAFFIC', 'CONTENT ANALYST', 'COMPOSITOR', 'DIGITAL IMAGING'}
COLORS = {'FFF6B26B': 'M_SORE', 'FF000000': 'M_MALAM'}


def extract(filename, tab):
    with zipfile.ZipFile(filename) as archive:
        def xml(path):
            return ET.fromstring(archive.read(path))
        strings = [''.join(node.itertext()) for node in xml('xl/sharedStrings.xml')]
        styles = xml('xl/styles.xml')
        fills = [node.find('s:patternFill/s:fgColor', NS) for node in styles.find('s:fills', NS)]
        formats = list(styles.find('s:cellXfs', NS))
        relations = {node.get('Id'): node.get('Target') for node in xml('xl/_rels/workbook.xml.rels')}
        sheet = next(node for node in xml('xl/workbook.xml').find('s:sheets', NS) if node.get('name') == tab)
        relation = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        rows = xml('xl/' + relations[relation]).findall('s:sheetData/s:row', NS)
        def value(cell):
            raw = cell.findtext('s:v', '', NS)
            return strings[int(raw)] if cell.get('t') == 's' else raw
        month, year = tab.split()
        day_count = calendar.monthrange(2000 + int(year), list(calendar.month_abbr).index(month.title()))[1]
        result, dates, dept, name_col = {}, {}, None, None
        for row in rows:
            cells = {re.sub(r'\d', '', cell.get('r')): cell for cell in row}
            headings = [col for col, cell in cells.items() if value(cell).strip().upper() == 'NAME']
            if headings:
                name_col = headings[0]
                dates = {col: str(int(float(value(cell)))) for col, cell in cells.items()
                         if value(cell).replace('.', '', 1).isdigit() and 1 <= float(value(cell)) <= day_count}
                assert len(dates) == day_count, 'Incomplete date header'
            if name_col not in cells:
                continue
            name = value(cells[name_col]).strip()
            if name.upper() in DEPARTMENTS:
                dept = name.upper()
                result[dept] = {}
                continue
            if not name or name.upper() in {'CATERING', 'KETERANGAN', 'TOTAL', 'NAME'}:
                dept = None
                continue
            if dept is None:
                continue
            mapping = {}
            for col, day in dates.items():
                cell = cells.get(col)
                if cell is None or value(cell).strip().upper() != 'M':
                    continue
                fill = fills[int(formats[int(cell.get('s', '0'))].get('fillId', '0'))]
                color = fill.get('rgb') if fill is not None else None
                if color not in COLORS:
                    raise ValueError(f'Unknown M color {color}: {tab} {dept} {name} {day}')
                mapping[day] = COLORS[color]
            if mapping:
                result[dept][' '.join(name.lower().split())] = mapping
        assert set(result) == DEPARTMENTS, 'Incomplete departments'
        return result


if __name__ == '__main__':
    filename, tab, timestamp = sys.argv[1:]
    mapping = extract(filename, tab)
    path = Path(__file__).resolve().parents[1] / 'js/data/m-color-snapshot.js'
    source = path.read_text()
    snapshot = json.loads(re.search(r'window.CA_M_COLOR_SNAPSHOT=(.*);', source)[1])
    snapshot[tab] = mapping
    source = re.sub(r'window.CA_M_COLOR_SNAPSHOT=.*;', lambda _: 'window.CA_M_COLOR_SNAPSHOT=' + json.dumps(snapshot, separators=(',', ':')) + ';', source)
    source = re.sub(r'window.CA_M_COLOR_SNAPSHOT_AT=.*;', lambda _: 'window.CA_M_COLOR_SNAPSHOT_AT=' + json.dumps(timestamp, ensure_ascii=False) + ';', source)
    path.write_text(source)
    print(tab, {dept: sum(len(days) for days in people.values()) for dept, people in mapping.items()})
