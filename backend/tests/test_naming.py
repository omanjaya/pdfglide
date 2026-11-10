"""Tests for user-facing download names (no internal IDs, tidy underscores)."""

import re
from pathlib import Path

import pytest

from app.utils.naming import (
    MAX_STEM_LENGTH,
    build_download_name,
    clean_download_name,
    clean_stem,
    strip_storage_prefix,
)

ID = "8e9d7047236149d99f3a7a5ec49343c2"
TS = "1794279589"
LEAK_RE = re.compile(r"[a-f0-9]{32}_\d{9,11}", re.IGNORECASE)
EDGE_CHARS = "_ -."


def _stem(name: str) -> str:
    return Path(name).stem


# --------------------------------------------------------------------------
# build_download_name
# --------------------------------------------------------------------------

def test_reported_case():
    stored = f"/uploads/{ID}_{TS}_0_Onco_n_ILD_IC_.pdf"
    assert build_download_name(Path(stored), "compressed", ".pdf") == "Onco_n_ILD_IC_compressed.pdf"


@pytest.mark.parametrize(
    "source, expected",
    [
        (f"{ID}_{TS}_0_report.pdf", "report_merged.pdf"),
        (f"{ID}_{TS}_7_report.pdf", "report_merged.pdf"),
        (f"{ID}_{TS}_12_report.pdf", "report_merged.pdf"),
        (f"{ID}_{TS}_report.pdf", "report_merged.pdf"),  # no order part
        (f"/tmp/some/dir/{ID}_{TS}_0_report.pdf", "report_merged.pdf"),
        (f"{ID.upper()}_{TS}_0_report.pdf", "report_merged.pdf"),
        (f"{ID}_{TS}_0_{ID}_{TS}_1_report.pdf", "report_merged.pdf"),  # doubled prefix
    ],
)
def test_prefix_variants(source, expected):
    assert build_download_name(source, "merged", ".pdf") == expected


@pytest.mark.parametrize(
    "source",
    [f"{ID}_{TS}_0.pdf", f"{ID}_{TS}.pdf", f"{ID}_{TS}_0_.pdf"],
)
def test_bare_internal_id_falls_back_to_file(source):
    assert build_download_name(source, "compressed") == "file_compressed.pdf"
    assert build_download_name(source) == "file.pdf"


def test_custom_fallback():
    assert build_download_name(f"{ID}_{TS}_0.pdf", "merged", fallback="files") == "files_merged.pdf"


@pytest.mark.parametrize(
    "source, expected",
    [
        ("report.pdf", "report_split.pdf"),
        ("My Report.pdf", "My Report_split.pdf"),
        ("a_b_c.pdf", "a_b_c_split.pdf"),
        ("12345.pdf", "12345_split.pdf"),
        ("abcdef.pdf", "abcdef_split.pdf"),
        # 32 hex but no timestamp: not an internal ID, must be kept
        ("8e9d7047236149d99f3a7a5ec49343c2.pdf", "8e9d7047236149d99f3a7a5ec49343c2_split.pdf"),
    ],
)
def test_names_without_prefix_left_alone(source, expected):
    assert build_download_name(source, "split") == expected


@pytest.mark.parametrize(
    "stored, expected",
    [
        (f"{ID}_{TS}_0_2024_report.pdf", "2024_report_compressed.pdf"),
        (f"{ID}_{TS}_0_2024.pdf", "2024_compressed.pdf"),
        (f"{ID}_{TS}_3_1_final.pdf", "1_final_compressed.pdf"),
        (f"{ID}_{TS}_0_123456789_x.pdf", "123456789_x_compressed.pdf"),
    ],
)
def test_original_name_starting_with_digits_is_kept(stored, expected):
    assert build_download_name(stored, "compressed") == expected


@pytest.mark.parametrize(
    "source, expected",
    [
        ("a__b.pdf", "a_b.pdf"),
        ("a____b.pdf", "a_b.pdf"),
        ("a___b__c.pdf", "a_b_c.pdf"),
        ("a  b.pdf", "a b.pdf"),
        ("a..b.pdf", "a.b.pdf"),
    ],
)
def test_repeated_separators_collapsed(source, expected):
    assert build_download_name(source) == expected


@pytest.mark.parametrize(
    "source, expected",
    [
        ("_report_.pdf", "report.pdf"),
        ("__report__.pdf", "report.pdf"),
        (" report .pdf", "report.pdf"),
        ("-report-.pdf", "report.pdf"),
        ("..report...pdf", "report.pdf"),
        ("_ -report- _.pdf", "report.pdf"),
        ("report_.pdf", "report.pdf"),
    ],
)
def test_edges_trimmed(source, expected):
    assert build_download_name(source) == expected


@pytest.mark.parametrize("stem", ["_", "___", " ", "-", "_-_", "...", "_ _"])
def test_junk_only_stem_falls_back(stem):
    assert build_download_name(f"{stem}.pdf", "merged") == "file_merged.pdf"


@pytest.mark.parametrize(
    "source, expected",
    [
        ("Laporan_Keuangan_é.pdf", "Laporan_Keuangan_é_x.pdf"),
        ("日本語のファイル.pdf", "日本語のファイル_x.pdf"),
        ("Привет_мир.pdf", "Привет_мир_x.pdf"),
        (f"{ID}_{TS}_0_Ünïcödé.pdf", "Ünïcödé_x.pdf"),
    ],
)
def test_unicode_letters_preserved(source, expected):
    assert build_download_name(source, "x") == expected


@pytest.mark.parametrize("operation", [None, "", "___", "  ", "-"])
def test_no_operation_means_no_suffix(operation):
    assert build_download_name("report.pdf", operation, ".docx") == "report.docx"


def test_operation_is_cleaned():
    assert build_download_name("report.pdf", "split pages!") .endswith(".pdf")
    assert "__" not in build_download_name("report.pdf", "a__b")
    assert build_download_name("report.pdf", "_merged_") == "report_merged.pdf"


@pytest.mark.parametrize("ext", [".docx", "docx"])
def test_extension_with_and_without_dot(ext):
    assert build_download_name(f"{ID}_{TS}_0_report.pdf", None, ext) == "report.docx"


def test_extension_defaults_to_source():
    assert build_download_name("report.PDF", "x") == "report_x.PDF"
    assert build_download_name("photo.jpg", "resized") == "photo_resized.jpg"


@pytest.mark.parametrize("ext", ["", ".", None])
def test_empty_extension(ext):
    # explicit empty extension means no extension; None means "use the source's"
    result = build_download_name("report.pdf", "x", ext)
    assert result in ("report_x", "report_x.pdf")
    if ext in ("", "."):
        assert result == "report_x"


def test_source_without_extension_and_no_extension_given():
    assert build_download_name("report", "x") == "report_x"


def test_dotted_stem_keeps_inner_dots():
    assert build_download_name("my.report.v2.pdf", "x") == "my.report.v2_x.pdf"


@pytest.mark.parametrize("source", [None, "", Path("")])
def test_source_none_or_empty(source):
    assert build_download_name(source, "compressed", ".pdf") == "file_compressed.pdf"
    assert build_download_name(source, None, ".pdf") == "file.pdf"
    assert build_download_name(source, "merged", "pdf", fallback="files") == "files_merged.pdf"


def test_length_cap():
    long_stem = "a" * 300
    name = build_download_name(f"{ID}_{TS}_0_{long_stem}.pdf", "compressed")
    stem = _stem(name)
    assert stem.endswith("_compressed")
    assert len(stem) - len("_compressed") <= MAX_STEM_LENGTH
    assert name.endswith(".pdf")


def test_length_cap_does_not_leave_trailing_separator():
    # Cut point lands right on an underscore
    long_stem = "a" * (MAX_STEM_LENGTH - 1) + "_" + "b" * 50
    name = build_download_name(f"{long_stem}.pdf")
    assert not _stem(name).endswith("_")
    assert len(_stem(name)) <= MAX_STEM_LENGTH


def test_length_cap_applies_after_prefix_removal():
    name = build_download_name(f"{ID}_{TS}_0_{'x' * MAX_STEM_LENGTH}.pdf")
    assert _stem(name) == "x" * MAX_STEM_LENGTH


def test_path_and_str_inputs_equivalent():
    s = f"/a/b/{ID}_{TS}_0_report.pdf"
    assert build_download_name(s, "x") == build_download_name(Path(s), "x")


def test_directory_components_ignored():
    assert build_download_name("/etc/../tmp/report.pdf", "x") == "report_x.pdf"


# --------------------------------------------------------------------------
# strip_storage_prefix / clean_stem
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "stem, expected",
    [
        (f"{ID}_{TS}_0_name", "name"),
        (f"{ID}_{TS}_name", "name"),
        (f"{ID}_{TS}_0", ""),
        (f"{ID}_{TS}", ""),
        ("plain_name", "plain_name"),
        ("", ""),
        (f"name_{ID}_{TS}", f"name_{ID}_{TS}"),  # only a leading prefix is stripped
        (f"{ID}_{TS}_0_2024_report", "2024_report"),
    ],
)
def test_strip_storage_prefix(stem, expected):
    assert strip_storage_prefix(stem) == expected


@pytest.mark.parametrize(
    "stem, expected",
    [
        ("Onco_n_ILD_IC_", "Onco_n_ILD_IC"),
        ("a__b", "a_b"),
        ("a/b", "a_b"),
        ("a:b*c?", "a_b_c"),
        ("", "file"),
        ("___", "file"),
    ],
)
def test_clean_stem(stem, expected):
    assert clean_stem(stem) == expected


def test_clean_stem_custom_fallback():
    assert clean_stem("__", fallback="") == ""
    assert clean_stem("__", fallback="x") == "x"


# --------------------------------------------------------------------------
# clean_download_name
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "leaked, expected",
    [
        ("3a10b2b0acf24d7a829ff7452fb92c32_1781167113_0_Yaho_converted.pdf", "Yaho_converted.pdf"),
        ("150c867b93f04f4f89a353ff990cae29_1771899453_pages__merged.pdf", "pages_merged.pdf"),
        ("dc6de892a1f94c63a897ea3ce9a8a110_1774017485_0_2___extracted.pdf", "2_extracted.pdf"),
        (
            "f089420efebd48e89d2e6cdf4cf85d58_1785042959_0_KuesionerPenelitian_Ni_Kadek_Jelita__2_.docx",
            "KuesionerPenelitian_Ni_Kadek_Jelita_2.docx",
        ),
        (f"{ID}_{TS}_0_Onco_n_ILD_IC_.pdf", "Onco_n_ILD_IC.pdf"),
    ],
)
def test_clean_download_name_real_leaks(leaked, expected):
    assert clean_download_name(leaked) == expected


@pytest.mark.parametrize(
    "name",
    [
        "report.pdf",
        "Onco_n_ILD_IC_compressed.pdf",
        "My Report_split.pdf",
        "2024_report.pdf",
        "my.report.v2.docx",
        "日本語.pdf",
        "a-b-c.pdf",
        "noextension",
    ],
)
def test_clean_download_name_clean_names_are_noop(name):
    assert clean_download_name(name) == name


@pytest.mark.parametrize(
    "name",
    [
        "report.pdf",
        "a__b.pdf",
        "_x_.pdf",
        "___.pdf",
        f"{ID}_{TS}_0_Onco_n_ILD_IC_.pdf",
        f"{ID}_{TS}_0_2024_report.pdf",
        f"{ID}_{TS}_0_{ID}_{TS}_1_x__y.pdf",
        "150c867b93f04f4f89a353ff990cae29_1771899453_pages__merged.pdf",
        "a - b (1).pdf",
        "report (1).pdf",
    ],
)
def test_clean_download_name_idempotent(name):
    once = clean_download_name(name)
    assert clean_download_name(once) == once


def test_clean_download_name_empty_uses_fallback():
    assert clean_download_name("") == "file"
    assert clean_download_name(f"{ID}_{TS}_0.pdf") == "file.pdf"
    assert clean_download_name(f"{ID}_{TS}_0.pdf", fallback="files") == "files.pdf"


# --------------------------------------------------------------------------
# Property checks over nasty inputs
# --------------------------------------------------------------------------

NASTY_SOURCES = [
    f"{ID}_{TS}_0_Onco_n_ILD_IC_.pdf",
    f"{ID}_{TS}_0_.pdf",
    f"{ID}_{TS}_0___.pdf",
    f"{ID}_{TS}_0_{ID}_{TS}_1_{ID}_{TS}_2_x.pdf",
    f"{ID.upper()}_{TS}_0_UPPER.pdf",
    f"{ID}_{TS}_0_2024_report.pdf",
    f"{ID}_{TS}_0_pages__merged.pdf",
    f"{ID}_{TS}_0_2___extracted.pdf",
    f"{ID}_{TS}_0_Kuesioner_Ni_Kadek__2_.docx",
    f"{ID}_{TS}_0_ - leading dash.pdf",
    f"{ID}_{TS}_0_trailing dash - .pdf",
    f"{ID}_{TS}_0_.hidden.pdf",
    f"{ID}_{TS}_0_dots....pdf",
    f"{ID}_{TS}_0_日本語_.pdf",
    f"{ID}_{TS}_0_{'z' * 300}.pdf",
    f"{ID}_{TS}_0_{'_' * 100}a.pdf",
    f"{ID}_{TS}_0_{'a' * 79}_{'b' * 20}.pdf",
    "__.pdf",
    "_.pdf",
    ".pdf",
    "..pdf",
    "   .pdf",
    "a___b___c___.pdf",
    "a b   c.pdf",
    "weird!@#$%^&*()name.pdf",
    "tab\tname\nnewline.pdf",
    "../../etc/passwd",
    "report (1).pdf",
    "a - _ - b.pdf",
    "x_ _y.pdf",
    "",
]


@pytest.mark.parametrize("source", NASTY_SOURCES)
@pytest.mark.parametrize("operation", [None, "compressed", "_weird__op_", "split pages"])
def test_never_leaks_or_leaves_ugly_separators(source, operation):
    name = build_download_name(source, operation, ".pdf")
    stem = _stem(name)
    assert not LEAK_RE.search(name), name
    assert "__" not in name, name
    assert stem, name
    assert stem[0] not in EDGE_CHARS, name
    assert stem[-1] not in EDGE_CHARS, name


@pytest.mark.parametrize("source", NASTY_SOURCES)
def test_clean_download_name_property(source):
    name = clean_download_name(source)
    stem = _stem(name)
    assert not LEAK_RE.search(name), name
    assert "__" not in name, name
    assert stem and stem[0] not in EDGE_CHARS and stem[-1] not in EDGE_CHARS, name
    assert clean_download_name(name) == name


# --------------------------------------------------------------------------
# Regressions found while writing these tests
# --------------------------------------------------------------------------

def test_parentheses_do_not_leave_space_underscore_mix():
    name = build_download_name("report (1).pdf")
    assert " _" not in name and "_ " not in name, name


def test_unsafe_extension_is_not_passed_through():
    name = build_download_name("report.pdf", "x", ".pd/f")
    assert "/" not in name


# --------------------------------------------------------------------------
# BaseService wrappers
# --------------------------------------------------------------------------

def _services():
    from app.services.base import BaseService

    return BaseService.generate_output_name, BaseService.generate_multi_output_name


def test_wrapper_generate_output_name_reported_case():
    single, _ = _services()
    path = Path(f"/uploads/{ID}_{TS}_0_Onco_n_ILD_IC_.pdf")
    assert single(path, "compressed") == "Onco_n_ILD_IC_compressed.pdf"


@pytest.mark.parametrize(
    "path, op, ext, expected",
    [
        (f"{ID}_{TS}_0_report.pdf", "merged", ".pdf", "report_merged.pdf"),
        (f"{ID}_{TS}_report.pdf", "split", ".pdf", "report_split.pdf"),
        (f"{ID}_{TS}_0_2024_report.pdf", "compressed", ".pdf", "2024_report_compressed.pdf"),
        (f"{ID}_{TS}_0_report.pdf", "text", ".txt", "report_text.txt"),
        (f"{ID}_{TS}_0_report.pdf", "text", "txt", "report_text.txt"),
        (f"{ID}_{TS}_0_pages__merged.pdf", "x", ".pdf", "pages_merged_x.pdf"),
        (f"{ID}_{TS}_0.pdf", "merged", ".pdf", "file_merged.pdf"),
        ("plain.pdf", "rotated", ".pdf", "plain_rotated.pdf"),
    ],
)
def test_wrapper_generate_output_name(path, op, ext, expected):
    single, _ = _services()
    assert single(Path(path), op, ext) == expected


def test_wrapper_generate_output_name_default_extension_is_pdf():
    single, _ = _services()
    assert single(Path(f"{ID}_{TS}_0_photo.png"), "converted") == "photo_converted.pdf"


def test_wrapper_callable_without_instance():
    from app.services.base import BaseService

    assert BaseService.generate_output_name(Path("a.pdf"), "x") == "a_x.pdf"
    assert BaseService.generate_multi_output_name([Path("a.pdf")], "x") == "a_x.pdf"


def test_wrapper_multi_uses_first_file():
    _, multi = _services()
    paths = [
        Path(f"{ID}_{TS}_0_first.pdf"),
        Path(f"{ID}_{TS}_1_second.pdf"),
        Path(f"{ID}_{TS}_2_third.pdf"),
    ]
    assert multi(paths, "merged") == "first_merged.pdf"


@pytest.mark.parametrize(
    "ext, expected",
    [(".pdf", "first_zipped.pdf"), (".zip", "first_zipped.zip"), ("zip", "first_zipped.zip")],
)
def test_wrapper_multi_extension(ext, expected):
    _, multi = _services()
    assert multi([Path(f"{ID}_{TS}_0_first.pdf")], "zipped", ext) == expected


def test_wrapper_multi_default_extension_is_pdf():
    _, multi = _services()
    assert multi([Path(f"{ID}_{TS}_0_a.docx")], "merged") == "a_merged.pdf"


def test_wrapper_multi_empty_list_falls_back_to_files():
    _, multi = _services()
    assert multi([], "merged") == "files_merged.pdf"
    assert multi([], "merged", ".zip") == "files_merged.zip"


def test_wrapper_multi_bare_id_first_file_falls_back_to_files():
    _, multi = _services()
    assert multi([Path(f"{ID}_{TS}_0.pdf")], "merged") == "files_merged.pdf"


def test_wrapper_multi_single_item_equals_single_wrapper():
    single, multi = _services()
    p = Path(f"{ID}_{TS}_0_Onco_n_ILD_IC_.pdf")
    assert multi([p], "compressed") == single(p, "compressed")


@pytest.mark.parametrize("source", NASTY_SOURCES)
def test_wrapper_outputs_never_leak(source):
    single, multi = _services()
    for name in (single(Path(source), "op"), multi([Path(source)], "op")):
        assert not LEAK_RE.search(name), name
        assert "__" not in name, name
        assert name.endswith(".pdf")
