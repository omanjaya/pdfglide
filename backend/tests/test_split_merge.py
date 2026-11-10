"""Split / extract / merge: size, fidelity and merge download names.

Fixture PDFs are built in-process (PyMuPDF); no DB, network or stored files.
"""

import asyncio
import os
from pathlib import Path

import fitz
import pikepdf
import pytest

from app.processors.pdf.merger import PDFMerger
from app.processors.pdf.organizer import PDFOrganizer
from app.processors.pdf.splitter import PDFSplitter
from app.services.base import BaseService

BIG = 300_000  # random (incompressible) bytes for the image on page 3 only


def _build(path: Path, big_page: int = 2) -> Path:
    """3 pages: page 2 (index 1) rotated, page 3 carries a large image,
    page 1 has a link to page 3, a form field; bookmarks + metadata set."""
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page(width=300 + 20 * i, height=400)
        page.insert_text((50, 80), f"Page {i + 1}", fontsize=20)
    side = int(BIG ** 0.5 / 3**0.5)
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, side, side), False)
    pix.set_rect(pix.irect, (0, 0, 0))
    pix = fitz.Pixmap(fitz.csRGB, side, side, bytearray(os.urandom(side * side * 3)), False)
    doc[big_page].insert_image(fitz.Rect(20, 100, 280, 360), stream=pix.tobytes("png"))
    doc[0].insert_link(
        {"kind": fitz.LINK_GOTO, "from": fitz.Rect(40, 60, 140, 90), "page": big_page, "to": fitz.Point(0, 0)}
    )
    widget = fitz.Widget()
    widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget.field_name = "name_field"
    widget.rect = fitz.Rect(40, 200, 200, 230)
    widget.field_value = "hello"
    doc[0].add_widget(widget)
    doc[1].set_rotation(90)
    doc.set_toc([[1, "Intro", 1], [1, "Middle", 2], [2, "Sub of middle", 2], [1, "Image page", 3]])
    doc.set_metadata({"title": "My Title", "author": "Me"})
    doc.save(path)
    return path


@pytest.fixture(scope="module")
def src(tmp_path_factory) -> Path:
    return _build(tmp_path_factory.mktemp("src") / "doc.pdf")


def _run(coro):
    return asyncio.run(coro)


def _split(src: Path, out: Path, pages: str):
    out.mkdir(exist_ok=True)
    return _run(PDFSplitter(out).execute(src, pages, "id"))


def _pixels(page) -> bytes:
    return page.get_pixmap(dpi=40).samples


# ---------------------------------------------------------------- size

def test_part_without_big_image_is_much_smaller(src, tmp_path):
    parts = _split(src, tmp_path / "o", "1,3")
    whole = src.stat().st_size
    small, big = parts[0].stat().st_size, parts[1].stat().st_size
    assert whole > BIG
    assert small < whole * 0.2, (small, whole)  # page 1 links to page 3 but must not carry it
    assert big > BIG * 0.9  # the page that really has the image keeps all of it


def test_split_part_names_unchanged(src, tmp_path):
    parts = _split(src, tmp_path / "o", "1-2,3")
    assert [p.name for p in parts] == ["id_pages_1-2.pdf", "id_pages_3-3.pdf"]


def test_ascii85_encoding_removed_losslessly(tmp_path):
    import base64

    pdf = pikepdf.new()
    pdf.add_blank_page(page_size=(100, 100))
    payload = os.urandom(5000)
    stream = pikepdf.Stream(pdf, payload)
    stream.write(base64.a85encode(payload, adobe=True), filter=pikepdf.Name.ASCII85Decode)
    stream.Filter = pikepdf.Array([pikepdf.Name.ASCII85Decode])
    pdf.pages[0].obj["/Extra"] = stream
    path = tmp_path / "a85.pdf"
    pdf.save(path)
    out = tmp_path / "o"
    out.mkdir()
    res = _run(PDFOrganizer(out).execute(path, out / "r.pdf", [1]))
    with pikepdf.open(res) as r:
        assert "/ASCII85Decode" not in str(r.pages[0].obj["/Extra"].get("/Filter"))
        assert r.pages[0].obj["/Extra"].read_bytes() == payload
    assert res.stat().st_size < 6000  # ASCII85 would be >= 6250


# ---------------------------------------------------------------- fidelity

def test_split_keeps_pages_size_rotation_pixels(src, tmp_path):
    parts = _split(src, tmp_path / "o", "2,3")
    orig = fitz.open(src)
    for part, idx in zip(parts, (1, 2)):
        out = fitz.open(part)
        assert len(out) == 1
        assert out[0].rect == orig[idx].rect
        assert out[0].rotation == orig[idx].rotation
        assert _pixels(out[0]) == _pixels(orig[idx])


def test_split_keeps_metadata_links_form_and_bookmarks(src, tmp_path):
    part = _split(src, tmp_path / "o", "1-2")[0]
    doc = fitz.open(part)
    assert doc.metadata["title"] == "My Title" and doc.metadata["author"] == "Me"
    # bookmark to the dropped page 3 is gone; the others point to the new pages
    toc = doc.get_toc()
    assert [(lvl, t, pg) for lvl, t, pg, *_ in toc] == [
        (1, "Intro", 1), (1, "Middle", 2), (2, "Sub of middle", 2)
    ]
    # the link to dropped page 3 was removed, not left dangling
    assert not [l for l in doc[0].get_links() if l["kind"] == fitz.LINK_GOTO]
    # form field survives and is registered in /AcroForm
    widgets = list(doc[0].widgets())
    assert [w.field_name for w in widgets] == ["name_field"]
    assert widgets[0].field_value == "hello"
    with pikepdf.open(part) as p:
        assert len(p.Root.AcroForm.Fields) == 1


def test_internal_link_between_kept_pages_survives(src, tmp_path):
    part = _split(src, tmp_path / "o", "1-3")[0]
    links = [l for l in fitz.open(part)[0].get_links() if l["kind"] == fitz.LINK_GOTO]
    assert links and links[0]["page"] == 2


def test_inherited_page_attributes_survive(tmp_path):
    pdf = pikepdf.new()
    pdf.add_blank_page(page_size=(200, 300))
    pdf.add_blank_page(page_size=(200, 300))
    pages = pdf.Root.Pages
    pages.Rotate = 90
    pages.MediaBox = pikepdf.Array([0, 0, 200, 300])
    for p in pdf.pages:
        del p.obj["/MediaBox"]
    path = tmp_path / "inh.pdf"
    pdf.save(path)
    part = _split(path, tmp_path / "o", "2")[0]
    out = fitz.open(part)
    assert out[0].rotation == 90
    assert out[0].mediabox == fitz.Rect(0, 0, 200, 300)


def test_organizer_extract_reorder_delete(src, tmp_path):
    out = tmp_path / "o"
    out.mkdir()
    org = PDFOrganizer(out)
    orig = fitz.open(src)

    ext = _run(org.extract_pages(src, out / "e.pdf", [3, 1]))
    d = fitz.open(ext)
    assert len(d) == 2
    assert _pixels(d[0]) == _pixels(orig[2]) and _pixels(d[1]) == _pixels(orig[0])
    assert d.metadata["title"] == "My Title"

    dele = _run(org.delete_pages(src, out / "d.pdf", [3]))
    assert dele.stat().st_size < src.stat().st_size * 0.2
    dd = fitz.open(dele)
    assert len(dd) == 2 and dd[1].rotation == 90


def test_organizer_extract_bookmarks_follow_new_order(src, tmp_path):
    out = tmp_path / "o"
    out.mkdir()
    res = _run(PDFOrganizer(out).extract_pages(src, out / "e.pdf", [3, 1]))
    toc = [(t, pg) for _, t, pg, *_ in fitz.open(res).get_toc()]
    assert sorted(toc) == [("Image page", 1), ("Intro", 2)]


def test_merge_keeps_pages_metadata_bookmarks(src, tmp_path):
    other = _build(tmp_path / "other.pdf")
    out = tmp_path / "m.pdf"
    _run(PDFMerger(tmp_path).execute([src, other], out))
    doc = fitz.open(out)
    origs = [fitz.open(src), fitz.open(other)]
    assert len(doc) == 6
    for i in range(6):
        orig = origs[i // 3]
        assert doc[i].rect == orig[i % 3].rect and doc[i].rotation == orig[i % 3].rotation
        assert _pixels(doc[i]) == _pixels(orig[i % 3])
    assert doc.metadata["title"] == "My Title"
    toc = doc.get_toc()
    assert [pg for _, _, pg, *_ in toc] == [1, 2, 2, 3, 4, 5, 5, 6]
    # no growth beyond the two inputs
    assert out.stat().st_size < src.stat().st_size + other.stat().st_size


# ---------------------------------------------------------------- naming

ID = "0123456789abcdef0123456789abcdef_1700000000"


def _stored(stem: str, order: int = 0) -> Path:
    return Path(f"/tmp/uploads/{ID}_{order}_{stem}.pdf")


def test_merge_name_two_files():
    name = BaseService.generate_multi_output_name([_stored("A"), _stored("B", 1)], "merged")
    assert name == "A_and_B_merged.pdf"


def test_merge_name_three_or_more_files():
    files = [_stored("A"), _stored("B", 1), _stored("C", 2)]
    assert BaseService.generate_multi_output_name(files, "merged") == "A_and_2_more_merged.pdf"
    files += [_stored("D", 3)]
    assert BaseService.generate_multi_output_name(files, "merged") == "A_and_3_more_merged.pdf"


def test_merge_name_single_and_empty_unchanged():
    assert BaseService.generate_multi_output_name([_stored("A")], "merged") == "A_merged.pdf"
    assert BaseService.generate_multi_output_name([], "merged") == "files_merged.pdf"


def test_merge_name_images_to_pdf():
    files = [Path(f"/x/{ID}_{i}_photo{i}.jpg") for i in range(2)]
    assert BaseService.generate_multi_output_name(files, "converted", ".pdf") == "photo0_and_photo1_converted.pdf"


def test_merge_name_long_names_are_bounded_and_leak_no_id():
    long = "x" * 200
    name = BaseService.generate_multi_output_name([_stored(long), _stored(long, 1)], "merged")
    assert len(name) <= 80 + len("_merged.pdf")
    assert ID[:32] not in name and name.endswith("_merged.pdf")
    name3 = BaseService.generate_multi_output_name([_stored("a.b"), _stored("c", 1), _stored("d", 2)], "merged")
    assert name3 == "a.b_and_2_more_merged.pdf"
