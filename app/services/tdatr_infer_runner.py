"""
Run TDATR infer.py with runtime compatibility shims.
"""

from __future__ import annotations

import runpy
import sys


def _patch_omegaconf_utils() -> None:
    """
    TDATR_utils expects omegaconf._utils.is_primitive_type (removed in newer OmegaConf).
    Add a compatible fallback at runtime when needed.
    """
    try:
        from omegaconf import _utils as oc_utils  # type: ignore
    except Exception:
        return

    if hasattr(oc_utils, "is_primitive_type"):
        return

    if hasattr(oc_utils, "is_primitive_type_annotation"):
        oc_utils.is_primitive_type = oc_utils.is_primitive_type_annotation  # type: ignore[attr-defined]
        return

    primitives = (str, bytes, int, float, bool, type(None))

    def _is_primitive_type(value: object) -> bool:
        if isinstance(value, type):
            return value in primitives
        return isinstance(value, primitives)

    oc_utils.is_primitive_type = _is_primitive_type  # type: ignore[attr-defined]


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: tdatr_infer_runner.py <infer.py> [args...]")

    infer_script = sys.argv[1]
    infer_args = sys.argv[2:]

    _patch_omegaconf_utils()

    sys.argv = [infer_script, *infer_args]
    runpy.run_path(infer_script, run_name="__main__")


if __name__ == "__main__":
    main()
