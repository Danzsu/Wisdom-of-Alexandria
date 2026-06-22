import io

import pytest
from PIL import Image

from app.services import cover_compositor as cc


def _png(w=1024, h=1536, color=(20, 30, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def test_available_layouts_nonempty():
    slugs = {lay.slug for lay in cc.available_cover_layouts()}
    assert {"classic_centered", "bottom_scrim", "top_minimal"} <= slugs


def test_compose_outputs_exact_kdp_dimensions():
    out = cc.compose_cover(_png(), layout="classic_centered", title="A Fárosz", author="Rácz D.")
    with Image.open(io.BytesIO(out)) as img:
        assert img.size == (cc.COVER_W, cc.COVER_H) == (1600, 2560)
        assert img.format == "PNG"


def test_compose_draws_text_over_background():
    plain = _png()  # uniform colour
    out = cc.compose_cover(plain, layout="classic_centered", title="CÍM", author="SZERZŐ")
    # The composite must differ from a bare crop/resize of the same background.
    bare = cc._cover_crop(Image.open(io.BytesIO(plain)).convert("RGB"), cc.COVER_W, cc.COVER_H)
    bare_bytes = io.BytesIO()
    bare.save(bare_bytes, "PNG")
    assert out != bare_bytes.getvalue()


def test_long_title_wraps_and_fits():
    long_title = "Egy nagyon hosszú cím amely biztosan több sorba törik a borítón rendben"
    out = cc.compose_cover(_png(), layout="bottom_scrim", title=long_title, author="X")
    with Image.open(io.BytesIO(out)) as img:
        assert img.size == (1600, 2560)  # did not crash; produced a valid cover


def test_unknown_layout_raises():
    with pytest.raises(ValueError):
        cc.compose_cover(_png(), layout="does_not_exist", title="t", author="a")


def test_missing_font_raises(tmp_path, monkeypatch):
    # Spec: a missing font must fail LOUDLY (ValueError), never silently.
    monkeypatch.setattr(cc, "_FONTS_DIR", tmp_path)
    with pytest.raises(ValueError, match="cover font missing"):
        cc.compose_cover(_png(), layout="classic_centered", title="t", author="a")
