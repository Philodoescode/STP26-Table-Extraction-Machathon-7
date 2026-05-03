import os
import random
import sys
sys.path.append("your project path")
import logging
import argparse
import json
import time
import traceback
import numpy as np
import hydra
from pathlib import Path
from hydra.core.hydra_config import HydraConfig
from omegaconf import OmegaConf, open_dict
import tqdm
import re
from PIL import Image
from generation_my.api2 import generate2
from torchvision import transforms
from timm.data.constants import IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD
import cv2
from TDATR_utils.utils import add_defaults
logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=os.environ.get("LOGLEVEL", "INFO").upper(),
    stream=sys.stdout,
)
data_str = time.strftime('%Y-%m-%d-%H-%M-%S_', time.localtime())
logger = logging.getLogger(data_str+__name__)

import torch
import torch.nn.functional as F
from omegaconf import OmegaConf

from TDATR_utils.initialize import initialize_hulk, hydra_init
from TDATR_utils.utils import convert_namespace_to_omegaconf, omegaconf_no_object_check
from TDATR_utils.call_main import call_main

from TDATR_utils.global_variables import ParallelMode
from TDATR_utils.global_context import global_context as gpc

LAYOUT_THRESHOLD = 0.0
TABLE_PADDING = 5.0
LAYOUT_BATCH_SIZE = None
QUERY_TEXT = "将图片中的表格转换为HTML语言。<iflytek_ret>"


@hydra.main(".", config_name="config")
def hydra_main(cfg) -> float:
    _hydra_main(cfg)


def _hydra_main(cfg, **kwargs) -> float:
    # print(cfg.common)

    if HydraConfig.initialized():
        with open_dict(cfg):
            cfg.job_logging_cfg = OmegaConf.to_container(HydraConfig.get().job_logging, resolve=True)

    with omegaconf_no_object_check():
        cfg = OmegaConf.create(OmegaConf.to_container(cfg, resolve=True, enum_to_str=True))
    OmegaConf.set_struct(cfg, True)

    try:
        call_main(cfg, main, **kwargs)
    except BaseException as e:
        if not cfg.common.suppress_crashes:
            raise
        else:
            logger.error("Crashed! " + str(e))


def set_seed(seed):
    import random
    import numpy as np
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def normalize_image_path(image_path):
    if not isinstance(image_path, str):
        return image_path

    normalized_path = image_path.strip()
    if normalized_path.startswith("mnt/"):
        normalized_path = "/" + normalized_path
    elif re.match(r"^[A-Za-z]:[\\/]", normalized_path):
        drive = normalized_path[0].lower()
        remainder = normalized_path[2:].replace("\\", "/").lstrip("/")
        normalized_path = f"/mnt/{drive}/{remainder}"

    return normalized_path


def clip_xyxy(box, width, height):
    x1, y1, x2, y2 = [float(v) for v in box]
    x1 = max(0.0, min(x1, float(width)))
    y1 = max(0.0, min(y1, float(height)))
    x2 = max(0.0, min(x2, float(width)))
    y2 = max(0.0, min(y2, float(height)))
    if x2 < x1:
        x1, x2 = x2, x1
    if y2 < y1:
        y1, y2 = y2, y1
    return [x1, y1, x2, y2]


def is_valid_xyxy(box):
    return box[2] > box[0] and box[3] > box[1]


def shift_cell_boxes_to_page(cell_boxes, offset_x, offset_y, page_width, page_height):
    if len(cell_boxes) == 0:
        return cell_boxes

    shifted_boxes = cell_boxes.copy()
    shifted_boxes[:, [0, 2]] += int(offset_x)
    shifted_boxes[:, [1, 3]] += int(offset_y)
    shifted_boxes[:, [0, 2]] = np.clip(shifted_boxes[:, [0, 2]], 0, page_width)
    shifted_boxes[:, [1, 3]] = np.clip(shifted_boxes[:, [1, 3]], 0, page_height)
    return shifted_boxes.astype(np.int32)


def get_canvas_for_visualization(image_path, original_size_wh):
    normalized_path = normalize_image_path(image_path)
    if isinstance(normalized_path, str):
        image = cv2.imread(normalized_path)
        if image is not None:
            return image, normalized_path

    if (
        isinstance(original_size_wh, (list, tuple))
        and len(original_size_wh) == 2
        and original_size_wh[0] > 0
        and original_size_wh[1] > 0
    ):
        width = int(original_size_wh[0])
        height = int(original_size_wh[1])
        blank = np.full((height, width, 3), 255, dtype=np.uint8)
        return blank, normalized_path

    return None, normalized_path


def normalize_bbox_to_int_xyxy(bbox):
    if not bbox or len(bbox) != 4:
        return None

    x0, y0, x1, y1 = bbox
    x0 = int(np.floor(x0))
    y0 = int(np.floor(y0))
    x1 = int(np.ceil(x1))
    y1 = int(np.ceil(y1))
    if x1 <= x0 or y1 <= y0:
        return None
    return [x0, y0, x1, y1]


def get_project_root():
    return Path(__file__).resolve().parents[2]


def resolve_existing_dir_path(path):
    normalized_path = normalize_image_path(path)
    base_path = Path(normalized_path).expanduser()
    candidates = [base_path]

    if not base_path.is_absolute():
        hydra_orig_cwd = os.environ.get("HYDRA_ORIG_CWD")
        if not hydra_orig_cwd and HydraConfig.initialized():
            hydra_runtime = getattr(HydraConfig.get(), "runtime", None)
            hydra_orig_cwd = getattr(hydra_runtime, "cwd", None)
        if hydra_orig_cwd:
            candidates.append(Path(hydra_orig_cwd).expanduser() / base_path)
        candidates.append(get_project_root() / base_path)

    for candidate in candidates:
        if candidate.is_dir():
            return candidate.resolve()

    return candidates[0]


def is_tables_full_dir(path):
    root = resolve_existing_dir_path(path)
    if not root.is_dir():
        return False
    return any(child.is_dir() and (child / "config.json").is_file() for child in root.iterdir())


def load_prompt_samples(prompt_path):
    with open(prompt_path, 'r') as f:
        return json.load(f)


def load_precomputed_table_samples(tables_dir):
    root = resolve_existing_dir_path(tables_dir)
    if not root.is_dir():
        raise FileNotFoundError(f"table crops directory not found: {root}")

    samples = []
    for config_path in sorted(root.glob("*/config.json")):
        with open(config_path, "r") as f:
            config = json.load(f)

        image_path = normalize_image_path(config.get("image_path"))
        crops = []
        for crop_index, crop in enumerate(config.get("crops", [])):
            crop_file = crop.get("crop_file")
            if not crop_file:
                continue
            crop_path = config_path.parent / crop_file
            bbox = normalize_bbox_to_int_xyxy(crop.get("bbox_orig_space"))
            crops.append(
                {
                    "table_index": crop_index,
                    "crop_path": str(crop_path.resolve()),
                    "crop_file": crop_file,
                    "score": float(crop.get("score", 0.0)),
                    "bbox": bbox,
                    "crop_size": crop.get("crop_size_wh"),
                }
            )

        samples.append(
            {
                "sample_id": config_path.parent.name,
                "image_path": image_path,
                "original_size_wh": config.get("original_size_wh"),
                "detector": config.get("detector", "precomputed_crops"),
                "threshold": config.get("threshold"),
                "padding": config.get("padding"),
                "crops": crops,
            }
        )

    if not samples:
        raise ValueError(f"no tables_full-style config.json files found under: {root}")

    return samples


def build_layout_predictor(device):
    project_package_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    removed_paths = []
    for path in list(sys.path):
        if path and os.path.abspath(path) == project_package_dir:
            removed_paths.append(path)
            sys.path.remove(path)

    loaded_tokenizers = sys.modules.get("tokenizers")
    loaded_tokenizers_file = getattr(loaded_tokenizers, "__file__", "") or ""
    if loaded_tokenizers_file and os.path.abspath(loaded_tokenizers_file).startswith(project_package_dir + os.sep):
        sys.modules.pop("tokenizers", None)

    try:
        try:
            from surya.foundation import FoundationPredictor
            from surya.layout import LayoutPredictor
            from surya.settings import settings
        except ImportError as exc:
            raise ImportError(
                "Surya is required for table detection before TSR. Install the surya package in the inference environment."
            ) from exc
    finally:
        for path in reversed(removed_paths):
            sys.path.insert(0, path)

    foundation_predictor = FoundationPredictor(
        checkpoint=settings.LAYOUT_MODEL_CHECKPOINT,
        device=str(device),
    )
    layout_predictor = LayoutPredictor(foundation_predictor)
    layout_predictor.disable_tqdm = True
    return layout_predictor


def detect_tables_with_layout(
    image,
    layout_predictor,
    score_threshold=LAYOUT_THRESHOLD,
    padding=TABLE_PADDING,
    batch_size=LAYOUT_BATCH_SIZE,
):
    orig_w, orig_h = image.size
    layout_result = layout_predictor([image], batch_size=batch_size)[0]

    detections = []
    for layout_box in layout_result.bboxes:
        if layout_box.label != "Table":
            continue

        score = float(layout_box.confidence) if layout_box.confidence is not None else 0.0
        if score < score_threshold:
            continue

        padded_box = clip_xyxy(
            [
                float(layout_box.bbox[0]) - padding,
                float(layout_box.bbox[1]) - padding,
                float(layout_box.bbox[2]) + padding,
                float(layout_box.bbox[3]) + padding,
            ],
            orig_w,
            orig_h,
        )
        if is_valid_xyxy(padded_box):
            detections.append({"bbox": padded_box, "score": score})

    detections.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))
    return detections


@torch.inference_mode()
def encode_img(model, dataset, image_input, device, image_info_path=None):
    image, scale, img_shape,scale_r = dataset.load_image_padding_train(
        image_input,
        info_path=image_info_path,
    )
    image_padding_shape = image.shape[1:]
    image = image.unsqueeze(0).to(device)
    image_embed, donut_outs = model.encode_img(image, image.clone().detach())
    donut_outs = [ i.half() for i in donut_outs]
    det_input = [donut_outs, scale, img_shape,scale_r, image_padding_shape]
    image_embed = image_embed.half()
    image_embed = image_embed.permute(1,0,2)    
    return image_embed, det_input
    
class Dataset_infer():
    def __init__(self):
        self.max_image_length = 1024
        self.to_tensor = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD),
            ]
        )
        
    def get_target_shape(self, dt_shape, target_shape_info):
        max_length = target_shape_info['max_length']
        patch_size = target_shape_info['patch_size']
        h, w = dt_shape[:2]
        
        #规则边长到固定倍数
        if h%patch_size!=0:
            h += (patch_size-h%patch_size)

        if w%patch_size!=0:
            w += (patch_size-w%patch_size)
        
        #规则边长到固定尺寸
        if h>w:
            nh = max_length
            nw = w/h*max_length
        else:
            nw = max_length
            nh = h/w*max_length
        
        target_shape = [int(nh), int(nw)]
        return target_shape
        
    def get_scale_ratio(self,info_path):
        data_set_list = {
            "SynthTabNet":2.5,
            "pubtabnet":4,
            "pubtables":2,
            "TabRecSet":2,
            'table_parsing_to_html':3,
        }
        
        r = 1
        if not isinstance(info_path, str):
            return r
        for i,v in data_set_list.items():
            if i.lower() in info_path.lower():
                r = v
                break

        return r

    def recover_pred_cell_box2raw_image(self, image_shape, scale, scale_r, cell_boxes):
        # pdb.set_trace()
        
        h,w = image_shape
        h_scale, w_scale = scale
        cell_boxes = np.clip(cell_boxes, 0,1)
        cell_boxes = cell_boxes * np.array([[w,h,w,h]])/ np.array([[w_scale*scale_r,h_scale*scale_r,w_scale*scale_r,h_scale*scale_r]])

        cell_boxes = np.round(cell_boxes).astype(np.int32)
        return cell_boxes
    
    def load_image_padding_train(self,image_name, info_path=None):
        normalized_image_name = normalize_image_path(image_name)
        if isinstance(normalized_image_name, str):
            img = cv2.imread(normalized_image_name)
            scale_info_path = normalized_image_name
        else:
            img = normalized_image_name
            scale_info_path = normalize_image_path(info_path)
        if img is None:
            raise FileNotFoundError(f"unable to read image: {normalized_image_name}")
        scale_r = self.get_scale_ratio(scale_info_path)
        # scale_r = 1
        img = cv2.resize(img, dsize=None, fx=scale_r, fy=scale_r, interpolation=cv2.INTER_CUBIC)
        
        ori_shape = img.shape[:2]
        min_patch = 256
        cur_shape = list(img.shape[:2])
        max_length = max(cur_shape)
        self_max_length = self.max_image_length
        #超出最大尺寸，缩放
        if max_length>=self_max_length:
            target_shape_info = {}
            target_shape_info['max_length'] = self_max_length
            target_shape_info['patch_size'] = 1
            cur_shape = self.get_target_shape(cur_shape, target_shape_info) 

        padding = [0, 0]
        if min(cur_shape) >= min_patch:
            cur_shape[0] = cur_shape[0] if cur_shape[0] % min_patch == 0 else cur_shape[0] + (min_patch - cur_shape[0] % min_patch)
            cur_shape[1] = cur_shape[1] if cur_shape[1] % min_patch == 0 else cur_shape[1] + (min_patch - cur_shape[1] % min_patch)
        elif max(cur_shape) >= min_patch:
            if cur_shape[0] > cur_shape[1]:
                cur_shape[0] = cur_shape[0] if cur_shape[0] % min_patch == 0 else cur_shape[0] + (min_patch - cur_shape[0] % min_patch)
                padding[1] = min_patch - cur_shape[1] 
            else:
                cur_shape[1] = cur_shape[1] if cur_shape[1] % min_patch == 0 else cur_shape[1] + (min_patch - cur_shape[1] % min_patch)
                padding[0] = min_patch - cur_shape[0]
        else:
            padding[0] = min_patch - cur_shape[0]
            padding[1] = min_patch - cur_shape[1]

        scale = np.array(cur_shape) / np.array(ori_shape)
        img = cv2.resize(img, (cur_shape[1], cur_shape[0]))
        img = cv2.copyMakeBorder(img, 0, padding[0], 0, padding[1], cv2.BORDER_CONSTANT, value=(255, 255, 255))
        img_shape = img.shape[:2]
        img = self.to_tensor(img)
        return img, scale, img_shape, scale_r
    
    def process_cell_info(self, cell_boxes, cell_texts, cell_spans_html, cell_confidences=None):
        c = 0
        cells_list = list()
        for id, cells in enumerate(cell_spans_html):
            cell_row_list = list()
            for c_id,cell in enumerate(cells):
                confidence = 1.0
                if cell_confidences and id < len(cell_confidences) and c_id < len(cell_confidences[id]):
                    confidence = float(cell_confidences[id][c_id])
                cell_temp = dict(
                    row_id = id,
                    text = cell_texts[id][c_id],
                    box = cell_boxes[c].tolist(),
                    span_html = cell,
                    confidence = confidence,
                )
                c=c+1
                cell_row_list.append(cell_temp)
            cells_list.append(cell_row_list)
        return cells_list


def _compute_cell_confidences_from_lprobs(tokenizer, gen_tokens, gen_lprobs, cell_ranges):
    """Map decoder token log-probs to a per-cell confidence in [0, 1]."""
    if gen_lprobs is None:
        return [[1.0 for _ in row] for row in cell_ranges]

    if hasattr(gen_lprobs, "detach"):
        lprobs = gen_lprobs.detach().cpu().tolist()
    else:
        lprobs = list(gen_lprobs)
    token_count = len(lprobs)
    if token_count == 0:
        return [[1.0 for _ in row] for row in cell_ranges]

    confidences = []
    for row in cell_ranges:
        row_confidences = []
        for c_i, c_j in row:
            c_i = int(c_i)
            c_j = int(c_j)
            if c_i < 0 or c_j < c_i:
                row_confidences.append(1.0)
                continue

            token_temp = gen_tokens[c_i:c_j + 1]
            begin_id = 0
            end_id = len(token_temp) - 1
            try:
                end_id_e = token_temp.index(tokenizer.cell_e_id)
                if end_id_e != -1:
                    end_id = end_id_e
            except Exception:
                pass

            if tokenizer.row_span_id in token_temp or tokenizer.col_span_id in token_temp:
                try:
                    begin_id_temp = token_temp.index(tokenizer.span_e)
                    if begin_id_temp != -1:
                        begin_id = begin_id_temp
                except Exception:
                    pass

            start = c_i + begin_id + 1
            end = c_i + end_id
            if end <= start:
                start, end = c_i, c_j + 1

            start = max(0, min(start, token_count))
            end = max(start, min(end, token_count))
            if end <= start:
                row_confidences.append(1.0)
                continue

            avg_logp = float(np.mean(lprobs[start:end]))
            confidence = float(np.exp(avg_logp))
            confidence = max(0.0, min(1.0, confidence))
            row_confidences.append(round(confidence, 6))
        confidences.append(row_confidences)
    return confidences


def run_tsr_on_table(
    model,
    tokenizer,
    dataset,
    device,
    eos_token,
    image_input,
    image_info_path,
    DetDataSample,
    InstanceData,
):
    image_embed, det_input = encode_img(
        model,
        dataset,
        image_input,
        device,
        image_info_path=image_info_path,
    )
    _, scale, img_shape, raw_scale, image_padding_shape = det_input

    data_sample = DetDataSample()
    instance_data = InstanceData()
    data_sample.gt_instances = instance_data
    data_sample.set_metainfo(
        {
            "img_shape": img_shape,
            "batch_input_shape": img_shape,
        }
    )

    _, raw_answer, clear_answer, _, _, _, cell_boxes_pred, cell_span_html, cell_texts, cell_confidences = single_prompt_process_cfgi(
        model,
        tokenizer,
        eos_token,
        QUERY_TEXT,
        image_embed,
        max_new_tokens=gpc.config.generation.max_len,
        sampling_topk=gpc.config.generation.sampling_topk,
        sampling_topp=gpc.config.generation.sampling_topp,
        temperature=gpc.config.generation.temperature,
        max_length=gpc.config.generation.max_len,
        random_seed=gpc.config.task.seed,
        image_shape=image_padding_shape,
        donuts_out=det_input[0],
        gt_inst=data_sample,
    )
    cell_boxes_pred = dataset.recover_pred_cell_box2raw_image(
        img_shape,
        scale,
        raw_scale,
        cell_boxes_pred,
    )
    return raw_answer, clear_answer, cell_boxes_pred, cell_span_html, cell_texts, cell_confidences


def build_table_answer(
    dataset,
    raw_answer,
    clear_answer,
    cell_boxes_pred,
    cell_texts,
    cell_span_html,
    cell_confidences=None,
):
    return dict(
        query=QUERY_TEXT,
        clear_answer=clear_answer,
        raw_answer=raw_answer,
        cells=dataset.process_cell_info(
            cell_boxes_pred,
            cell_texts,
            cell_span_html,
            cell_confidences=cell_confidences,
        ),
    )

def main(cfg) -> None:
    if isinstance(cfg, argparse.Namespace):
        cfg = convert_namespace_to_omegaconf(cfg)
    add_defaults(cfg)
    if cfg.common.npu:
        from TDATR_utils.npu import set_npu
        set_npu()
    initialize_hulk(cfg)
    if cfg.distributed_training.distributed_rank == 0 and "job_logging_cfg" in cfg:
        logging.config.dictConfig(OmegaConf.to_container(cfg.job_logging_cfg))

    # Check cfg
    cfg.model_parallel.recompute_granularity = None
    cfg.model_parallel.sequence_parallel = False
    cfg.model.parallel_output = False

    if gpc.get_world_size(ParallelMode.DATA) > 1:
        raise RuntimeError("The generation function does not support data parallelism!")
    
    from TDATR.models.mini_gpt4_ipt_v2 import MiniGPT4
    from TDATR.models.detect.structures_.instance_data import InstanceData
    from TDATR.models.detect.structures_.det_data_sample import DetDataSample
    dataset = Dataset_infer()    
    
    eos_token = '<end>'
    device = torch.device("cuda")

    model = MiniGPT4(cfg).half()
    tokenizer = model.ipt_tokenizer
    logger.info("model: {}".format(model.__class__.__name__))

    model.eval()
    model = model.to(device=device)
    
    # must be train state
    model.cfgi_decoder.neck.train()
    model.cfgi_decoder.encoder.train()

    tables_dir = getattr(cfg.generation, "table_crops_dir", None)
    prompt_path = cfg.generation.prompt_path
    use_precomputed_crops = False
    if tables_dir:
        tables_dir = normalize_image_path(tables_dir)
        use_precomputed_crops = True
    elif prompt_path and is_tables_full_dir(prompt_path):
        tables_dir = normalize_image_path(prompt_path)
        use_precomputed_crops = True

    if use_precomputed_crops:
        samples = load_precomputed_table_samples(tables_dir)
        output_name_source = Path(tables_dir).name
        layout_predictor = None
        logger.info(f"table detector: precomputed crops from {tables_dir}")
    else:
        if not prompt_path:
            raise ValueError("generation.prompt_path is required when generation.table_crops_dir is not set")
        samples = load_prompt_samples(prompt_path)
        output_name_source = os.path.splitext(os.path.split(prompt_path)[1])[0]
        layout_predictor = build_layout_predictor(device)
        logger.info("table detector: surya_layout")

    output_base_dir = "output"
    output_dir = os.path.join(output_base_dir, "infer_TDATR")
    os.makedirs(output_dir, exist_ok=True)

    out_file_name = output_name_source
    output_vis_dir = os.path.join( output_dir, out_file_name, "out_vis" )
    output_dir = os.path.join( output_dir, out_file_name, "out_jsons" )
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(output_vis_dir, exist_ok=True)

    for sample in tqdm.tqdm(samples):
        if use_precomputed_crops:
            image_path = sample["image_path"]
            save_name = os.path.basename(image_path) if image_path else sample["sample_id"]
        else:
            image_path = normalize_image_path(sample)
            save_name = os.path.basename(image_path)
        logger.info(f"image_path: {image_path}")
        save_path = os.path.join(output_dir, save_name + ".json")
        
        if os.path.exists(save_path):
            continue

        if use_precomputed_crops:
            vis_image, normalized_image_path = get_canvas_for_visualization(
                image_path,
                sample.get("original_size_wh"),
            )
            if vis_image is None:
                raise FileNotFoundError(
                    f"unable to build visualization canvas for precomputed sample: {sample['sample_id']}"
                )
            image_path = normalized_image_path
            page_height, page_width = vis_image.shape[:2]
            detections = sample["crops"]
        else:
            original_image = cv2.imread(image_path)
            if original_image is None:
                raise FileNotFoundError(f"unable to read image: {image_path}")

            page_height, page_width = original_image.shape[:2]
            original_image_rgb = cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(original_image_rgb)
            detections = detect_tables_with_layout(
                image=pil_image,
                layout_predictor=layout_predictor,
            )
            vis_image = original_image.copy()

        table_results = []
        for table_idx, detection in enumerate(detections):
            if use_precomputed_crops:
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
            else:
                x0 = max(0, int(np.floor(detection["bbox"][0])))
                y0 = max(0, int(np.floor(detection["bbox"][1])))
                x1 = min(page_width, int(np.ceil(detection["bbox"][2])))
                y1 = min(page_height, int(np.ceil(detection["bbox"][3])))
                if x1 <= x0 or y1 <= y0:
                    continue

                crop_image = original_image[y0:y1, x0:x1].copy()
                if crop_image.size == 0:
                    continue
                score = detection["score"]
                table_index = table_idx
                crop_size = [x1 - x0, y1 - y0]

            raw_answer, clear_answer, cell_boxes_pred, cell_span_html, cell_texts, cell_confidences = run_tsr_on_table(
                model=model,
                tokenizer=tokenizer,
                dataset=dataset,
                device=device,
                eos_token=eos_token,
                image_input=crop_image,
                image_info_path=image_path,
                DetDataSample=DetDataSample,
                InstanceData=InstanceData,
            )
            if use_precomputed_crops and x1 is None:
                cell_boxes_output = cell_boxes_pred
                bbox_output = None
            else:
                cell_boxes_output = shift_cell_boxes_to_page(
                    cell_boxes_pred,
                    x0,
                    y0,
                    page_width,
                    page_height,
                )
                bbox_output = [x0, y0, x1, y1]

            answer = build_table_answer(
                dataset=dataset,
                raw_answer=raw_answer,
                clear_answer=clear_answer,
                cell_boxes_pred=cell_boxes_output,
                cell_texts=cell_texts,
                cell_span_html=cell_span_html,
                cell_confidences=cell_confidences,
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
            logger.info(
                json.dumps(
                    dict(
                        table_index=table_index,
                        bbox=bbox_output,
                        query=QUERY_TEXT,
                        clear_answer=clear_answer,
                    ),
                    ensure_ascii=False,
                )
            )

            if bbox_output is not None:
                cv2.rectangle(vis_image, (x0, y0), (x1, y1), (0, 255, 0), 3)
            for cell in cell_boxes_output:
                cv2.rectangle(vis_image, cell[:2].tolist(), cell[2:].tolist(), (0, 0, 255), 3)

        if not table_results:
            logger.warning(f"no tables detected for image: {image_path}")

        vis_path = os.path.join(output_vis_dir, save_name)
        cv2.imwrite(vis_path, vis_image)
        ans_info = dict(
            image_path=image_path,
            detector=dict(
                name=sample["detector"] if use_precomputed_crops else "surya_layout",
                threshold=sample.get("threshold") if use_precomputed_crops else LAYOUT_THRESHOLD,
                padding=sample.get("padding") if use_precomputed_crops else TABLE_PADDING,
            ),
            tables=table_results,
        )

        with open(save_path, "w") as f:
            f.write(json.dumps(ans_info, indent=4 ,ensure_ascii=False))
        logger.info(f"save result: {save_path}")
        logger.info(f"save vis in: {vis_path}")



@torch.no_grad()
def get_context_emb(model, prompt, image_tensor):
    img_embeds = image_tensor

    seg_embeds = list()
    seg_tokens = list()
    seg_embed, seg_token, *_ = model.encode_text([prompt])
    seg_embeds.append(seg_embed)
    seg_tokens.append(seg_token)

    mixed_embeds = torch.cat(seg_embeds, dim=1)
    mixed_tokens = torch.cat(seg_tokens, dim=1)

    return prompt, mixed_embeds, mixed_tokens, img_embeds #[BLC]

@torch.no_grad()
def pad_tokens(model, tokenizer, tokens, inputs_embeds, inputs_embeds_length, tokens_to_generate):
    max_prompt_len = torch.max(inputs_embeds_length).item()
    _B, _L = tokens.shape

    pad_tokens = torch.ones((_B, tokens_to_generate), device = tokens.device, dtype=tokens.dtype) * tokenizer.pad_id #[B, L_pad]
    pad_embeddings = model.ipt_model.embedding(pad_tokens, None).permute(1, 0, 2) #[B, L_pad, emd_dim]

    tokens = torch.cat([tokens, pad_tokens], dim = 1)
    inputs_embeds = torch.cat([inputs_embeds, pad_embeddings], dim=1)
    return tokens, inputs_embeds, inputs_embeds_length


def single_prompt_process_cfgi(model,tokenizer, eos_token, prompt, image_tensor, max_new_tokens=1024, sampling_topk=4, sampling_topp=0.0, 
               temperature=0.5, penalty=1.7, max_length=8192, random_seed=42, image_shape=None,donuts_out=None,gt_inst=None):

    prompt, embs, tokens, img_embeds = get_context_emb(model, prompt, image_tensor)  # [B, L, emb_dim]
    current_len = embs.shape[1] #B L C
    if current_len - max_length > 0:
        print('Warning: The number of tokens in current conversation exceeds the max length. '
                'The model will not see the contexts outside the range.')
    begin_idx = max(0, current_len - max_length)

    embs = embs[:, begin_idx:]
    tokens = tokens[:, begin_idx:]
    _B, _L, _D = embs.shape
    embs_length = torch.ones((_B,), device=embs.device, dtype=torch.long) * _L  # [B, L]
    


    bs_size = embs.shape[0]
    assert bs_size == 1, 'parallel decode is not implemented'

    with torch.no_grad():
        
        tokens, inputs_embeds, inputs_embeds_length = pad_tokens(model, tokenizer, tokens, embs, embs_length, max_new_tokens)
        (outputs,hidden_state_list),context_length_ywx  = generate2(
            model=model,
            tokenizer=tokenizer,
            tokens = tokens,
            inputs_embeds=inputs_embeds,
            img_embeds=img_embeds,
            inputs_embeds_length=inputs_embeds_length,
            tokens_to_generate=max_new_tokens,
            return_output_log_probs=True,
            top_k_sampling=sampling_topk,
            top_p_sampling=sampling_topp,
            temperature=temperature,
            penalty=penalty, 
            add_BOS=False,
            random_seed=random_seed
        )
        hidden_state_list = torch.concat(hidden_state_list, dim=1) 
        hidden_state_list = torch.split(hidden_state_list, 1, dim=-1)
        hidden_state_list = [i[...,0] for i in hidden_state_list]
        
        # 需要在此基础上，返回隐藏层状态
        raw_answer = outputs[0]["generate"]
        gen_tokens = outputs[0]["gen_token"]
        gen_lprobs = outputs[0].get("lprobs")

        out_answer = raw_answer.replace(eos_token, "")
        out_answer = out_answer.replace('<iflytek_ret>', '\n')

        cell_ranges, cell_spans,cell_texts = tokenizer.call_decoder_cell_ranges_and_cell_span(gen_tokens, bias=(current_len-1))
        cell_ranges_no_bias, _, _ = tokenizer.call_decoder_cell_ranges_and_cell_span(gen_tokens, bias=0)
        cell_confidences = _compute_cell_confidences_from_lprobs(
            tokenizer=tokenizer,
            gen_tokens=gen_tokens,
            gen_lprobs=gen_lprobs,
            cell_ranges=cell_ranges_no_bias,
        )
        cfgi_hidden_state,row_position,pred_row,pred_col = model.aggregate_cell_tokens( hidden_state_list, cell_range_ids=cell_ranges)
        
        
        row_mask1 = torch.where(pred_row.sigmoid()>0.5,1,0).to(pred_row)
        if torch.sum(row_mask1)==0:
            row_mask1 = torch.eye(row_mask1.shape[0])
        col_mask1 = torch.where(pred_col.sigmoid()>0.5,1,0).to(pred_col)
        if torch.sum(col_mask1)==0:
            col_mask1 = torch.eye(col_mask1.shape[0])

        cell_hidden_states,_ = model.cfgi_ipt_model.transformer(
                        hidden_states=cfgi_hidden_state,   
                        position_ids=None,
                        attention_mask=None,
                        kv_hidden_states=img_embeds,
                        row_col_positions=row_position,
                        row_same_mask=row_mask1[...,None],
                        col_same_mask=col_mask1[...,None],
                    )
        cell_boxes_pred = \
                model.cfgi_decoder.forward(cell_hidden_states, img_embeds.transpose(0,1), 
                                            image_shape, pred_row,pred_col,
                                            row_position,donuts_out, gt_inst)
        
        cell_boxes_pred = bbox_cxcywh_to_xyxy(cell_boxes_pred[-1])

        cell_boxes_pred = cell_boxes_pred.detach().cpu().numpy()[0]
    try:
        out_answer = reverseFormat(out_answer)
    except:
        pass
    return prompt, raw_answer, out_answer, gen_tokens, embs, context_length_ywx, \
        cell_boxes_pred, cell_spans, cell_texts, cell_confidences

def bbox_cxcywh_to_xyxy(bbox):
    """Convert bbox coordinates from (cx, cy, w, h) to (x1, y1, x2, y2).

    Args:
        bbox (Tensor): Shape (n, 4) for bboxes.

    Returns:
        Tensor: Converted bboxes.
    """
    cx, cy, w, h = bbox.split((1, 1, 1, 1), dim=-1)
    bbox_new = [(cx - 0.5 * w), (cy - 0.5 * h), (cx + 0.5 * w), (cy + 0.5 * h)]
    return torch.cat(bbox_new, dim=-1)

def reverseFormat(content):
    content = content.replace('<iflytek_html_html_s>', '<html>')
    content = content.replace('<iflytek_html_html_e>', '</html>')
    content = content.replace('<iflytek_html_body_s>', '<body>')
    content = content.replace('<iflytek_html_body_e>', '</body>')
    content = content.replace('<iflytek_html_table_s>', '<table>')
    content = content.replace('<iflytek_html_table_e>', '</table>')
    content = content.replace('<iflytek_html_thead_s>', '<thead>')
    content = content.replace('<iflytek_html_thead_e>', '</thead>')
    content = content.replace('<iflytek_html_tbody_s>', '<tbody>')
    content = content.replace('<iflytek_html_tbody_e>', '</tbody>')
    content = content.replace('<iflytek_html_td_s>', '<td>')
    content = content.replace('<iflytek_html_td_e>', '</td>')
    content = content.replace('<iflytek_html_tr_s>', '<tr>')
    content = content.replace('<iflytek_html_tr_e>', '</tr>')
    content = content.replace('<iflytek_br>', '<br>')
    pattern = re.compile(r'(<iflytek_html_span_s>(.*?)<iflytek_html_span_e>)')
    matched = pattern.findall(content)
    for match in matched:
        match = match[0]
        try:
            if 'rowspan' in match and 'colspan' in match:
                col_span_num = re.findall(r'<iflytek_html_colspan>(\d+)', match)[0]
                row_span_num = re.findall(r'<iflytek_html_rowspan>(\d+)', match)[0]
                if match.index('rowspan') > match.index('colspan'):
                    new_str = match.replace(f'<iflytek_html_span_s><iflytek_html_colspan>{col_span_num}', f'<td colspan={col_span_num} ')
                    new_str = new_str.replace(f'<iflytek_html_rowspan>{row_span_num}<iflytek_html_span_e>', f'rowspan={row_span_num}>')
                else:
                    new_str = match.replace(f'<iflytek_html_colspan>{col_span_num}<iflytek_html_span_e>', f'colspan={col_span_num}>')
                    new_str = new_str.replace(f'<iflytek_html_span_s><iflytek_html_rowspan>{row_span_num}', f'<td rowspan={row_span_num} ')
            elif 'rowspan' in match:
                row_span_num = re.findall(r'<iflytek_html_rowspan>(\d+)', match)[0]
                new_str = match.replace(f'<iflytek_html_span_s><iflytek_html_rowspan>{row_span_num}<iflytek_html_span_e>', f'<td rowspan={row_span_num}>')
            elif 'colspan' in match:
                
                col_span_num = re.findall(r'<iflytek_html_colspan>(\d+)', match)[0]
                new_str = match.replace(f'<iflytek_html_span_s><iflytek_html_colspan>{col_span_num}<iflytek_html_span_e>', f'<td colspan={col_span_num}>')
        except:
            traceback.print_exc()
            pass
        content = content.replace(match, new_str)

    content = content.replace('<iflytek_line_equation_s>', '')
    content = content.replace('<iflytek_line_equation_e>', '')
    content = content.replace('<iflytek_inline_equation_s>', '')
    content = content.replace('<iflytek_inline_equation_e>', '')
    content = content.replace('<iflytek_unk>', '')
    content = content.replace('<iflytek_left_brace>', '{')
    content = content.replace('<iflytek_right_brace>', '}')

    return content



def cli_main():
    try:
        from hydra._internal.utils import get_args

        cfg_name = get_args().config_name or "config"
    except:
        logger.warning("Failed to get config name from hydra args")
        cfg_name = "config"

    hydra_init(cfg_name)
    hydra_main()


if __name__ == "__main__":
    cli_main()
