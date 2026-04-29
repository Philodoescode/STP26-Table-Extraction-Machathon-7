"""
In-process TDATR singleton for table structure recognition.

Replaces the old subprocess-based invocation with a persistent model
that loads once and serves inference requests in-process.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# sys.path setup — must happen before any TDATR imports
# ---------------------------------------------------------------------------

_TDATR_PATHS_INSTALLED = False


def _ensure_tdatr_on_path(repo_dir: str) -> None:
    """Add the three required TDATR directories to sys.path (idempotent)."""
    global _TDATR_PATHS_INSTALLED
    if _TDATR_PATHS_INSTALLED:
        return

    repo = Path(repo_dir).resolve()
    needed = [
        str(repo),                  # for TDATR_utils.*
        str(repo / "TDATR"),        # for TDATR.* (models, tokenizers)
        str(repo / "TDATR" / "eval"),  # for generation_my.*
    ]
    for p in needed:
        if p not in sys.path:
            sys.path.insert(0, p)

    _TDATR_PATHS_INSTALLED = True


# ---------------------------------------------------------------------------
# OmegaConf compatibility patch (from tdatr_infer_runner.py)
# ---------------------------------------------------------------------------

def _patch_omegaconf_utils() -> None:
    """
    TDATR_utils expects omegaconf._utils.is_primitive_type which was removed
    in newer OmegaConf versions.  Add a compatible fallback at runtime.
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


# ---------------------------------------------------------------------------
# TDATRPredictor
# ---------------------------------------------------------------------------

class TDATRPredictor:
    """Persistent wrapper around the TDATR MiniGPT4 model.

    Loads the model once and keeps it on GPU.  Subsequent calls to
    :meth:`infer` reuse the warm model — no subprocess, no Hydra CLI,
    no checkpoint reload.
    """

    def __init__(self, settings: Any) -> None:
        import torch

        t0 = time.time()
        repo = Path(settings.tdatr_repo_dir).resolve()

        # 1. Ensure TDATR packages are importable
        _ensure_tdatr_on_path(str(repo))
        _patch_omegaconf_utils()

        # 2. Build OmegaConf config programmatically (replaces Hydra CLI)
        from omegaconf import OmegaConf, open_dict
        from TDATR_utils.dataclass import HulkConfig

        cfg_path = repo / "configs" / "config.yaml"
        yaml_cfg = OmegaConf.load(str(cfg_path))

        # Merge with HulkConfig dataclass defaults so every expected key
        # (common.seed, model_parallel.*, distributed_training.*, etc.)
        # is present even when the YAML doesn't list it explicitly.
        # This replicates what Hydra would do via structured configs.
        dc_cfg = OmegaConf.structured(HulkConfig())
        with open_dict(dc_cfg):
            cfg = OmegaConf.merge(dc_cfg, yaml_cfg)

        # Apply the same overrides that _run_tdatr used to pass on the
        # command line.  Using open_dict because the schema is strict.
        with open_dict(cfg):
            cfg.common.npu = True
            cfg.common.npu_jit_compile = False
            cfg.common.seed = settings.tdatr_seed
            cfg.model.rectification_rotate_flag = False
            cfg.model.rectification_textline_height_flag = False
            cfg.task.use_ocr_plug = False
            cfg.model.use_naiive = True
            cfg.model.cross_flash_attn = False
            cfg.model.lora.apply_lora = False
            cfg.model.use_vit_encoder = False
            cfg.model.use_donut_encoder = True
            cfg.model.use_cfgi = True
            cfg.model.ckpt = settings.tdatr_checkpoint_path
            cfg.generation.no_repeat_ngram_size = settings.tdatr_no_repeat_ngram_size
            cfg.generation.min_len = settings.tdatr_min_len
            cfg.generation.max_len = settings.tdatr_max_len
            cfg.generation.temperature = settings.tdatr_temperature
            cfg.task.seed = settings.tdatr_seed

        # Resolve interpolations and freeze
        from TDATR_utils.utils import omegaconf_no_object_check
        with omegaconf_no_object_check():
            cfg = OmegaConf.create(
                OmegaConf.to_container(cfg, resolve=True, enum_to_str=True)
            )
        OmegaConf.set_struct(cfg, True)

        # 3. Merge dataclass defaults (model + tokenizer configs)
        from TDATR_utils.utils import add_defaults
        add_defaults(cfg)

        # 4. NPU shim
        if cfg.common.npu:
            from TDATR_utils.npu import set_npu
            set_npu()

        # 5. Lightweight initialization — set gpc.config + seed WITHOUT
        #    calling the full initialize_hulk (which requires
        #    torch.distributed).
        from TDATR_utils.global_context import global_context as gpc
        from TDATR_utils.global_variables import ParallelMode

        # Manual single-GPU init: set up a trivial single-process group so
        # that torch.distributed.get_rank() works in TDATR generation code.
        import torch.distributed as dist
        if not dist.is_initialized():
            dist.init_process_group(
                backend="gloo", init_method="tcp://127.0.0.1:29500",
                rank=0, world_size=1,
            )

        gpc.config = cfg
        gpc._global_ranks[ParallelMode.GLOBAL] = 0
        gpc._local_ranks[ParallelMode.GLOBAL] = 0
        gpc._world_sizes[ParallelMode.GLOBAL] = 1
        gpc._groups[ParallelMode.GLOBAL] = None  # single-GPU, no group
        gpc._cpu_groups[ParallelMode.GLOBAL] = None
        gpc._ranks_in_group[ParallelMode.GLOBAL] = [0]
        gpc.world_size = 1
        gpc.data_parallel_size = 1
        gpc.pipeline_parallel_size = 1
        gpc.tensor_parallel_size = 1

        # Register DATA, MODEL, PIPELINE, TENSOR parallel modes as trivial
        for mode in [
            ParallelMode.DATA,
            ParallelMode.MODEL,
            ParallelMode.PIPELINE,
            ParallelMode.TENSOR,
        ]:
            gpc._global_ranks[mode] = 0
            gpc._local_ranks[mode] = 0
            gpc._world_sizes[mode] = 1
            gpc._groups[mode] = None
            gpc._cpu_groups[mode] = None
            gpc._ranks_in_group[mode] = [0]

        gpc.set_seed(cfg.common.seed)

        # cudnn settings
        from torch.backends import cudnn
        cudnn.benchmark = bool(cfg.common.cudnn_benchmark)
        cudnn.deterministic = bool(cfg.common.cudnn_deterministic)
        cudnn.enabled = True

        # Tweak model-parallel fields that main() normally overrides
        with open_dict(cfg):
            cfg.model_parallel.recompute_granularity = None
            cfg.model_parallel.sequence_parallel = False
            cfg.model.parallel_output = False

        # Re-store potentially modified cfg
        gpc.config = cfg

        # 7. Build model, tokenizer, dataset
        from TDATR.models.mini_gpt4_ipt_v2 import MiniGPT4
        from TDATR.models.detect.structures_.instance_data import InstanceData
        from TDATR.models.detect.structures_.det_data_sample import DetDataSample

        # Import the inference helpers from infer.py
        from infer import Dataset_infer, run_tsr_on_table, build_table_answer
        from infer import (
            load_precomputed_table_samples,
            get_canvas_for_visualization,
            shift_cell_boxes_to_page,
        )

        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        torch.cuda.set_device(0)

        import gc
        logger.info("Setting default dtype to float16 to save memory")
        old_dtype = torch.get_default_dtype()
        torch.set_default_dtype(torch.float16)

        self._model = MiniGPT4(cfg).half()

        torch.set_default_dtype(old_dtype)
        self._tokenizer = self._model.ipt_tokenizer
        self._model.eval()
        self._model = self._model.to(device=self._device)
        gc.collect()

        # CFGI decoder components must be in train mode
        self._model.cfgi_decoder.neck.train()
        self._model.cfgi_decoder.encoder.train()

        self._dataset = Dataset_infer()
        self._eos_token = "<end>"
        self._DetDataSample = DetDataSample
        self._InstanceData = InstanceData

        # Store function references
        self._run_tsr_on_table = run_tsr_on_table
        self._build_table_answer = build_table_answer
        self._load_precomputed_table_samples = load_precomputed_table_samples
        self._get_canvas_for_visualization = get_canvas_for_visualization
        self._shift_cell_boxes_to_page = shift_cell_boxes_to_page

        elapsed = time.time() - t0
        logger.info("TDATRPredictor initialized in %.1fs on %s", elapsed, self._device)

    # -----------------------------------------------------------------------
    # Inference
    # -----------------------------------------------------------------------

    def infer(self, crops_dir: Path, output_base_dir: Path | None = None) -> list[dict]:
        """Run structure recognition on precomputed table crops.

        Args:
            crops_dir: Directory produced by Surya detection+crop step,
                       containing per-page subdirs with config.json + PNGs.
            output_base_dir: If given, visualization images are saved here.

        Returns:
            List of per-image result dicts, each containing:
              - image_path, detector info, tables list with cells/bboxes
        """
        import cv2
        import numpy as np

        samples = self._load_precomputed_table_samples(str(crops_dir))
        all_results: list[dict] = []

        # Prepare visualization output dirs if requested
        vis_dir = None
        json_dir = None
        if output_base_dir is not None:
            out_name = Path(crops_dir).name
            vis_dir = output_base_dir / "output" / "infer_TDATR" / out_name / "out_vis"
            json_dir = output_base_dir / "output" / "infer_TDATR" / out_name / "out_jsons"
            vis_dir.mkdir(parents=True, exist_ok=True)
            json_dir.mkdir(parents=True, exist_ok=True)

        for sample in samples:
            image_path = sample["image_path"]
            save_name = (
                os.path.basename(image_path) if image_path else sample["sample_id"]
            )

            vis_image, normalized_image_path = self._get_canvas_for_visualization(
                image_path,
                sample.get("original_size_wh"),
            )
            if vis_image is None:
                raise FileNotFoundError(
                    f"unable to build visualization canvas for sample: {sample['sample_id']}"
                )
            image_path = normalized_image_path
            page_height, page_width = vis_image.shape[:2]
            detections = sample["crops"]

            table_results: list[dict] = []
            for table_idx, detection in enumerate(detections):
                bbox = detection.get("bbox")
                x0 = y0 = 0
                x1 = y1 = None
                if bbox is not None:
                    x0, y0, x1, y1 = bbox
                    x0 = max(0, min(x0, page_width))
                    y0 = max(0, min(y0, page_height))
                    x1 = max(0, min(x1, page_width))
                    y1 = max(0, min(y1, page_height))
                crop_image = detection["crop_path"]
                score = detection.get("score", 0.0)
                table_index = detection.get("table_index", table_idx)
                crop_size = detection.get("crop_size")

                raw_answer, clear_answer, cell_boxes_pred, cell_span_html, cell_texts = (
                    self._run_tsr_on_table(
                        model=self._model,
                        tokenizer=self._tokenizer,
                        dataset=self._dataset,
                        device=self._device,
                        eos_token=self._eos_token,
                        image_input=crop_image,
                        image_info_path=image_path,
                        DetDataSample=self._DetDataSample,
                        InstanceData=self._InstanceData,
                    )
                )

                if x1 is None:
                    cell_boxes_output = cell_boxes_pred
                    bbox_output = None
                else:
                    cell_boxes_output = self._shift_cell_boxes_to_page(
                        cell_boxes_pred, x0, y0, page_width, page_height,
                    )
                    bbox_output = [x0, y0, x1, y1]

                answer = self._build_table_answer(
                    dataset=self._dataset,
                    raw_answer=raw_answer,
                    clear_answer=clear_answer,
                    cell_boxes_pred=cell_boxes_output,
                    cell_texts=cell_texts,
                    cell_span_html=cell_span_html,
                )
                table_results.append(
                    dict(
                        table_index=table_index,
                        score=round(score, 4),
                        bbox=bbox_output,
                        crop_size=crop_size,
                        answer=answer,
                    )
                )

                # Draw visualization
                if bbox_output is not None:
                    cv2.rectangle(vis_image, (x0, y0), (x1, y1), (0, 255, 0), 3)
                for cell in cell_boxes_output:
                    cv2.rectangle(
                        vis_image, cell[:2].tolist(), cell[2:].tolist(), (0, 0, 255), 3
                    )

            ans_info = dict(
                image_path=image_path,
                detector=dict(
                    name=sample.get("detector", "precomputed_crops"),
                    threshold=sample.get("threshold"),
                    padding=sample.get("padding"),
                ),
                tables=table_results,
            )
            all_results.append(ans_info)

            # Save visualization and JSON if output dirs are available
            if vis_dir is not None:
                vis_path = str(vis_dir / save_name)
                cv2.imwrite(vis_path, vis_image)

            if json_dir is not None:
                save_path = str(json_dir / (save_name + ".json"))
                with open(save_path, "w", encoding="utf-8") as f:
                    f.write(json.dumps(ans_info, indent=4, ensure_ascii=False))

        return all_results


# ---------------------------------------------------------------------------
# Lazy thread-safe singleton (matches _get_layout_predictor pattern)
# ---------------------------------------------------------------------------

_tdatr_lock = threading.Lock()
_tdatr_predictor: TDATRPredictor | None = None


def _get_tdatr_predictor() -> TDATRPredictor:
    """Return the global TDATRPredictor, creating it on first call."""
    global _tdatr_predictor
    if _tdatr_predictor is not None:
        return _tdatr_predictor
    with _tdatr_lock:
        if _tdatr_predictor is not None:
            return _tdatr_predictor

        from app.config import get_settings
        settings = get_settings()
        _tdatr_predictor = TDATRPredictor(settings)
    return _tdatr_predictor
