"""Shared helpers for building a new PDF out of pages of existing PDFs.

Used by the splitter, organizer (extract / reorder / delete) and merger.
``pikepdf.Pdf.new()`` + ``pages.append()`` copies the pages but drops the
document-level structures around them, and may drag along data the new file
does not need. These helpers make the result lean and keep what users expect
to survive:

* unused page resources are dropped,
* links that point to pages which are not part of the output are removed
  (otherwise the whole target page, with its resources, is copied along),
* ASCII85/ASCIIHex transport encodings are removed from streams (lossless,
  they only inflate data by ~25%/100%),
* document info/XMP metadata, form fields (AcroForm) and bookmarks (outlines)
  that refer to kept pages are carried over.
"""

import base64
import binascii
from typing import Iterable, Optional

import pikepdf
from pikepdf import Array, Dictionary, Name, Object


# --------------------------------------------------------------------------
# Saving
# --------------------------------------------------------------------------

def save_lean(pdf: "pikepdf.Pdf", path) -> None:
    """Prune and save ``pdf`` with compact save options."""
    prune_unused_resources(pdf)
    strip_ascii_filters(pdf)
    pdf.save(
        path,
        compress_streams=True,
        object_stream_mode=pikepdf.ObjectStreamMode.generate,
        recompress_flate=True,
    )


def prune_unused_resources(pdf: "pikepdf.Pdf") -> None:
    """Drop resources a page never references (fonts, XObjects, ...)."""
    try:
        pdf.remove_unreferenced_resources()
    except Exception:  # pragma: no cover - never fail a job over an optimisation
        pass


_ASCII_FILTERS = ("/ASCII85Decode", "/A85", "/ASCIIHexDecode", "/AHx")


def _decode_ascii(name: str, data: bytes) -> bytes:
    if name in ("/ASCII85Decode", "/A85"):
        data = data.strip()
        if data.startswith(b"<~"):
            data = data[2:]
        if data.endswith(b"~>"):
            data = data[:-2]
        return base64.a85decode(data)
    data = data.strip()
    if data.endswith(b">"):
        data = data[:-1]
    data = b"".join(data.split())
    if len(data) % 2:
        data += b"0"
    return binascii.unhexlify(data)


def strip_ascii_filters(pdf: "pikepdf.Pdf") -> None:
    """Remove a leading ASCII85/ASCIIHex filter from streams, losslessly.

    The remaining filters (e.g. DCTDecode, FlateDecode) and the decoded
    content are untouched, so rendering is identical.
    """
    for obj in pdf.objects:
        try:
            if not isinstance(obj, pikepdf.Stream):
                continue
            filt = obj.get("/Filter")
            if filt is None:
                continue
            filters = list(filt) if isinstance(filt, Array) else [filt]
            if not filters or str(filters[0]) not in _ASCII_FILTERS:
                continue
            parms = obj.get("/DecodeParms")
            if parms is not None:
                plist = list(parms) if isinstance(parms, Array) else [parms]
                if plist and plist[0] is not None and not (
                    isinstance(plist[0], Dictionary) and len(plist[0].keys()) == 0
                ):
                    continue  # ASCII filters never have parms; be conservative
                rest_parms = plist[1:]
            else:
                rest_parms = []
            raw = _decode_ascii(str(filters[0]), obj.read_raw_bytes())
            rest = filters[1:]
            obj.write(raw, filter=None, decode_parms=None)  # set raw bytes
            # write() with filter=None stores the data as-is; restore filters.
            if rest:
                obj["/Filter"] = rest[0] if len(rest) == 1 else Array(rest)
                real = [p for p in rest_parms]
                if any(p is not None for p in real):
                    obj["/DecodeParms"] = real[0] if len(rest) == 1 else Array(real)
        except Exception:
            continue


# --------------------------------------------------------------------------
# Links
# --------------------------------------------------------------------------

def drop_dangling_links(pdf: "pikepdf.Pdf") -> None:
    """Remove link destinations that point to pages missing from ``pdf``.

    pikepdf nulls references to pages that were not copied, which leaves a
    link that looks clickable but goes nowhere (and, if a target page were
    copied as an orphan, would drag that page's resources along). Such links
    lose their destination. Links to pages in the output keep working.
    """
    kept = {p.objgen for p in pdf.pages}

    def is_page(obj) -> bool:
        try:
            return obj.get("/Type") == Name.Page
        except Exception:
            return False

    def dest_missing(dest) -> bool:
        if isinstance(dest, Array) and len(dest) > 0:
            first = dest[0]
            if first is None:
                return True  # qpdf nulls references to pages it did not copy
            if isinstance(first, Dictionary) and is_page(first):
                return first.objgen not in kept
        return False

    for page in pdf.pages:
        annots = page.obj.get("/Annots")
        if not isinstance(annots, Array):
            continue
        for annot in annots:
            try:
                if not isinstance(annot, Dictionary):
                    continue
                if "/Dest" in annot and dest_missing(annot["/Dest"]):
                    del annot["/Dest"]
                action = annot.get("/A")
                if isinstance(action, Dictionary) and action.get("/S") == Name.GoTo:
                    if dest_missing(action.get("/D")):
                        del annot["/A"]
            except Exception:
                continue


# --------------------------------------------------------------------------
# Metadata, forms, outlines
# --------------------------------------------------------------------------

def copy_metadata(src: "pikepdf.Pdf", dst: "pikepdf.Pdf") -> None:
    """Carry document info (title, author, ...) and XMP over to ``dst``."""
    try:
        for key, value in src.docinfo.items():
            if isinstance(value, pikepdf.String):
                # Info entries are plain strings; rebuild them (a direct object
                # of another Pdf cannot be assigned as-is).
                dst.docinfo[key] = pikepdf.String(str(value))
    except Exception:
        pass
    try:
        if "/Metadata" in src.Root:
            dst.Root.Metadata = dst.copy_foreign(src.Root.Metadata)
    except Exception:
        pass


def _widget_top_field(annot):
    field = annot
    seen = 0
    while "/Parent" in field and seen < 50:
        field = field["/Parent"]
        seen += 1
    return field


def copy_acroform(
    src: "pikepdf.Pdf", dst: "pikepdf.Pdf", acro: Optional[Dictionary] = None
) -> None:
    """Re-create ``/AcroForm`` in ``dst`` for the widgets on its pages.

    Only fields that have a widget on a page of ``dst`` are listed.
    Does nothing when ``src`` has no form or ``dst`` has no widgets.
    """
    try:
        src_acro = acro if acro is not None else src.Root.get("/AcroForm")
        if src_acro is None:
            return
        fields = []
        seen = set()
        for page in dst.pages:
            annots = page.obj.get("/Annots")
            if not isinstance(annots, Array):
                continue
            for annot in annots:
                if isinstance(annot, Dictionary) and annot.get("/Subtype") == Name.Widget:
                    top = _widget_top_field(annot)
                    if top.objgen not in seen:
                        seen.add(top.objgen)
                        fields.append(top)
        if not fields:
            return
        existing = dst.Root.get("/AcroForm")
        if existing is None:
            new_acro = Dictionary()
            for key in ("/DR", "/DA", "/Q", "/NeedAppearances", "/XFA"):
                if key == "/XFA":
                    continue  # XFA packets describe the whole form; not valid for a subset
                if key in src_acro:
                    new_acro[key] = dst.copy_foreign(src_acro[key])
            new_acro["/Fields"] = Array(fields)
            dst.Root.AcroForm = dst.make_indirect(new_acro)
        else:
            existing_fields = existing.get("/Fields")
            merged = list(existing_fields) if isinstance(existing_fields, Array) else []
            have = {f.objgen for f in merged}
            merged.extend(f for f in fields if f.objgen not in have)
            existing["/Fields"] = Array(merged)
    except Exception:
        pass


def _resolve_dest_page(src: "pikepdf.Pdf", item, names) -> Optional[Array]:
    """Return the destination array of an outline item, or None."""
    dest = getattr(item, "destination", None)
    if dest is None and item.action is not None:
        action = item.action
        if isinstance(action, Dictionary) and action.get("/S") == Name.GoTo:
            dest = action.get("/D")
    if dest is None:
        return None
    if not isinstance(dest, Array):
        if names is None:
            return None
        try:
            key = str(dest)
            found = names.get(key)
            if found is None:
                return None
            dest = found.get("/D") if isinstance(found, Dictionary) else found
        except Exception:
            return None
    if isinstance(dest, Array) and len(dest) > 0:
        return dest
    return None


def _name_tree(src: "pikepdf.Pdf"):
    try:
        names = src.Root.get("/Names")
        if names is not None and "/Dests" in names:
            return pikepdf.NameTree(names.Dests)
    except Exception:
        pass
    return None


def copy_outlines(
    sources: Iterable[tuple["pikepdf.Pdf", dict]],
    dst: "pikepdf.Pdf",
) -> None:
    """Rebuild bookmarks in ``dst``.

    ``sources`` yields ``(src_pdf, mapping)`` where ``mapping`` maps a source
    page ``objgen`` to the page index in ``dst`` it was copied to. A bookmark
    is kept when its target page is kept, or when any child's is.
    """
    try:
        new_roots = []
        for src, mapping in sources:
            if "/Outlines" not in src.Root:
                continue
            names = _name_tree(src)
            with src.open_outline() as outline:

                def convert(item):
                    kids = [c for c in (convert(k) for k in item.children) if c]
                    dest = _resolve_dest_page(src, item, names)
                    new_item = None
                    if dest is not None and isinstance(dest[0], Dictionary):
                        idx = mapping.get(dest[0].objgen)
                        if idx is not None:
                            parts = [dst.pages[idx].obj] + list(dest)[1:]
                            new_item = pikepdf.OutlineItem(
                                str(item.title), destination=Array(parts)
                            )
                    if new_item is None:
                        if not kids:
                            return None
                        # Parent bookmark whose own page was dropped: point it
                        # at its first surviving child's page.
                        new_item = pikepdf.OutlineItem(
                            str(item.title), destination=kids[0].destination
                        )
                    new_item.children.extend(kids)
                    return new_item

                for root_item in outline.root:
                    converted = convert(root_item)
                    if converted:
                        new_roots.append(converted)
        if new_roots:
            with dst.open_outline() as out:
                out.root.extend(new_roots)
    except Exception:
        pass
