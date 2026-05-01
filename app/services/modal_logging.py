from __future__ import annotations


def modal_input_label(default: str = "no-input") -> str:
    """Best-effort Modal input id label for concurrent log disambiguation."""
    try:
        import modal

        input_id = modal.current_input_id()
        if input_id:
            return input_id
    except Exception:
        pass
    return default
