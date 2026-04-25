# Tablecert — Architecture Modules and Configurations

> **Reference codebase paths:**
> - YOLO modules & layers: `YOLO_REDESIGN/main/func_yolo_layers.py`
> - YOLO builder: `YOLO_REDESIGN/main/yolo_builder.py`
> - YOLO training: `YOLO_REDESIGN/main/yolo_train_enhanced.py`
> - YOLO LoRA configs: `YOLO_REDESIGN/main/yolo_lora_config.py`
> - TATR builder & modules: `TATR_REDESIGN/main/tatr_builder.py`
> - TATR training: `TATR_REDESIGN/main/tatr_train_enhanced.py`
> - TATR LoRA configs: `TATR_REDESIGN/main/tatr_lora_config.py`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Custom Modules](#2-custom-modules)
   - 2.1 [FreqFilter2D](#21-freqfilter2d)
   - 2.2 [Boundary Refinement Module (BRM)](#22-boundary-refinement-module-brm)
   - 2.3 [Lite Transformer Block (LT)](#23-lite-transformer-block-lt)
   - 2.4 [CBAM — Channel + Spatial Attention](#24-cbam--channel--spatial-attention)
   - 2.5 [CoordConv / CoordPosEncoding](#25-coordconv--coordposencoding)
   - 2.6 [EnhancedBlock](#26-enhancedblock)
   - 2.7 [BiFPN (Bi-directional FPN)](#27-bifpn-bi-directional-fpn)
3. [YOLOv11 Enhanced Architecture](#3-yolov11-enhanced-architecture)
   - 3.1 [Integration Points](#31-integration-points)
   - 3.2 [Wrappers](#32-wrappers)
   - 3.3 [Builder Function & Version Configurations](#33-builder-function--version-configurations)
   - 3.4 [Training Hyperparameters](#34-training-hyperparameters)
4. [TATR Enhanced Architecture](#4-tatr-enhanced-architecture)
   - 4.1 [Integration Points](#41-integration-points)
   - 4.2 [Wrappers](#42-wrappers)
   - 4.3 [Builder Function & Version Configurations](#43-builder-function--version-configurations)
   - 4.4 [Training Hyperparameters](#44-training-hyperparameters)
5. [LoRA Fine-Tuning Strategy](#5-lora-fine-tuning-strategy)
   - 5.1 [YOLO LoRA — In-Place Parameter Injection](#51-yolo-lora--in-place-parameter-injection)
   - 5.2 [TATR LoRA — PEFT Library Integration](#52-tatr-lora--peft-library-integration)
   - 5.3 [LoRA Target Modules Reference](#53-lora-target-modules-reference)

---

## 1. Overview

The **Tablecert** framework extends two base models — **YOLOv11** (Ultralytics) and **Table Transformer (TATR)** (Microsoft / Hugging Face) — with plug-and-play enhancement modules designed to address specific challenges of table detection and recognition in legacy documents (certificates, scanned records, etc.).

| Challenge | Module Addressing It |
|---|---|
| Watermarks / scanning noise | `FreqFilter2D` |
| Double borders / ambiguous bounding boxes | `BRM` |
| Long-range structural context | `LiteTransformerBlock` |
| Channel/spatial feature reweighting | `CBAM` |
| Position awareness in table grids | `CoordConv / CoordPosEncoding` |
| Multi-scale feature fusion | `BiFPN` |
| Parameter-efficient fine-tuning | `LoRA` |

All modules are implemented in PyTorch and are designed to be inserted into existing architectures **without modifying original pre-trained weights** — except when LoRA low-rank matrices are explicitly injected.

---

## 2. Custom Modules

### 2.1 FreqFilter2D

**File:** `func_yolo_layers.py` (YOLO) | `tatr_builder.py` (TATR)  
**Purpose:** Applies a Fourier-domain low-pass filter to suppress high-frequency noise (watermarks, scan artefacts) before the image enters the backbone. Operates channel-wise on the full input tensor.

#### How it works

1. Converts input `x` to `float32` (FFT requires full precision).
2. Computes 2D FFT per image and applies `fftshift` to centre the spectrum.
3. Builds a binary low-pass mask: **only the central `cutoff_ratio × H/W` region is kept** (low frequencies = structural content).
4. Applies mask to the shifted spectrum.
5. Inverts the shift (`ifftshift`) and computes IFFT (`ifft2`), taking the real part.
6. Returns result cast back to the original dtype (supports `fp16`).

#### TATR variant — soft blending (`lambda_filter`)

The TATR implementation adds a `lambda_filter` parameter for a weighted mix between the filtered and original signal:

```
output = x_filtered × λ  +  x_original × (1 − λ)
```

This allows a gentler transition: `λ = 0` → no filtering; `λ = 1` → full low-pass filter.

#### Class definition (YOLO — `func_yolo_layers.py`)

```python
class FreqFilter2D(nn.Module):
    """Fourier-domain low-frequency enhancement filter."""
    def __init__(self, cutoff_ratio=0.15):
        ...
    def forward(self, x):
        # FFT → low-pass mask → IFFT
        ...
```

#### Class definition (TATR — `tatr_builder.py`)

```python
class FreqFilter2D(nn.Module):
    """Apply lightweight Fourier-domain low-pass/high-pass mask on images / feature maps."""
    def __init__(self, cutoff_ratio=0.15, lambda_filter=1.0):
        ...
    def forward(self, x):
        # Soft-blended low-pass filter
        return x_filtered * self.lambda_filter + x * (1 - self.lambda_filter)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `cutoff_ratio` | `float` | `0.15` | Fraction of the spectrum retained (centred, both H and W). Smaller values → stronger smoothing. |
| `lambda_filter` | `float` | `1.0` | *(TATR only)* Blend weight between filtered and original. |

---

### 2.2 Boundary Refinement Module (BRM)

**File:** `func_yolo_layers.py` (YOLO) | `tatr_builder.py` (TATR)  
**Purpose:** Refines boundary-sensitive spatial features to reduce localisation errors common with double-bordered tables or closely spaced table regions.

#### How it works

Two consecutive **1×1 convolutions** with BatchNorm and ReLU, followed by a **residual (skip) connection**. The 1×1 kernel is intentional — it learns a per-channel recalibration rather than a spatial filter, making the module lightweight and shape-agnostic.

```
residual = x
x → Conv1×1 → BN → ReLU → Conv1×1 → BN → ReLU(x + residual)
```

#### TATR variant — soft blending (`lambda_brm`)

```
output = ReLU(x_refined × λ  +  x_residual × (1 − λ))
```

#### Class definition

```python
class BRM(nn.Module):
    """Boundary Refinement Module."""
    def __init__(self, channels, lambda_brm=1.0):  # lambda_brm: TATR only
        self.conv1 = nn.Conv2d(channels, channels, 1)  # 1×1 conv
        self.bn1   = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 1)  # 1×1 conv
        self.bn2   = nn.BatchNorm2d(channels)
        self.act   = nn.ReLU()
    def forward(self, x):
        r = x
        x = self.act(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        return self.act(x + r)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `channels` | `int` | *(required)* | Number of input/output channels. Must match the integration point. |
| `lambda_brm` | `float` | `1.0` | *(TATR only)* Blend weight of refined vs. original features. |

#### Channel sizes at YOLO integration points

| Model index | Context | Channels |
|---|---|---|
| `18` | Concat after EnhancedBlock-17 (64+128) | 192 |
| `19` | C3k2 after Concat-18 | 128 |
| `21` | Concat after EnhancedBlock-20 (128+256) | 384 |

---

### 2.3 Lite Transformer Block (LT)

**File:** `func_yolo_layers.py` (YOLO) | `tatr_builder.py` (TATR)  
**Purpose:** Introduces lightweight self-attention over spatial tokens, enabling long-range contextual modelling for table structure understanding while maintaining a small parameter footprint.

#### How it works

1. **Input projection** — `Conv2d(C, C, 1)` to project features.
2. **Flatten** to sequence format: `(B, C, H, W) → (B, H×W, C)`.
3. **LayerNorm** + **TransformerEncoderLayer** (`d_model=C`, `nhead`, FFN with `dim_feedforward`).
4. **Reshape** back to `(B, C, H, W)`.
5. **Output projection** — `Conv2d(C, C, 1)` with **residual connection** from the input projection.

```
x_proj = proj_in(x)
seq    = Flatten → Norm → TransformerEncoderLayer
x_out  = Reshape(seq)
output = proj_out(x_out + x_proj)
```

#### Class definition

```python
class LiteTransformerBlock(nn.Module):
    def __init__(self, channels, nhead=4, dim_feedforward=256, dropout=0.1):
        self.proj_in      = nn.Conv2d(channels, channels, 1)
        self.norm         = nn.LayerNorm(channels)
        self.encoder_layer = nn.TransformerEncoderLayer(
            d_model=channels, nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout, batch_first=True
        )
        self.proj_out     = nn.Conv2d(channels, channels, 1)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `channels` | `int` | *(required)* | Token/feature dimension (= number of channels). |
| `nhead` | `int` | `4` | Number of attention heads. Must divide `channels`. |
| `dim_feedforward` | `int` | `256` | Hidden size of the FFN inside the Transformer layer. |
| `dropout` | `float` | `0.1` | Dropout probability inside the encoder layer. |

#### YOLO EnhancedBlock integration — adaptive parameter sizing

When the LiteTransformerBlock is embedded inside `EnhancedBlock`, parameters are adapted by channel count:

| channels | nhead | dim_feedforward |
|---|---|---|
| 64 | 4 | 128 |
| 128 | 4 | 256 |
| 256 | 8 | 512 |

---

### 2.4 CBAM — Channel + Spatial Attention

**File:** `func_yolo_layers.py` | `tatr_builder.py`  
**Purpose:** Convolutional Block Attention Module. Sequentially reweights features along the channel dimension, then the spatial dimension, to focus on the most discriminative table structure cues.

#### Components

**ChannelAttention** — dual-pooling (average + max) through a shared FC squeeze-excitation network:

```python
class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16, lambda_ca=1.0):
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction),
            nn.ReLU(),
            nn.Linear(channels // reduction, channels)
        )
    def forward(self, x):
        att = sigmoid(fc(avg_pool(x)) + fc(max_pool(x)))
        return x * (1 + (att - 1) * lambda_ca)  # soft blend
```

**SpatialAttention** — channel-pooling followed by a 7×7 convolution:

```python
class SpatialAttention(nn.Module):
    def __init__(self, kernel=7, lambda_sa=1.0):
        self.conv = nn.Conv2d(2, 1, kernel, padding=kernel//2)
    def forward(self, x):
        s   = cat([channel_avg(x), channel_max(x)], dim=1)
        att = sigmoid(conv(s))
        return x * (1 + (att - 1) * lambda_sa)
```

**CBAM** — sequential application:

```python
class CBAM(nn.Module):
    def __init__(self, channels, lambda_ca=1.0, lambda_sa=1.0):
        self.ca = ChannelAttention(channels, lambda_ca=lambda_ca)
        self.sa = SpatialAttention(lambda_sa=lambda_sa)
    def forward(self, x):
        return self.sa(self.ca(x))
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `channels` | `int` | *(required)* | Input channel count. |
| `reduction` | `int` | `16` | Channel reduction ratio in the FC squeeze layer. |
| `lambda_ca` | `float` | `1.0` | Channel attention blend weight. |
| `lambda_sa` | `float` | `1.0` | Spatial attention blend weight. |

---

### 2.5 CoordConv / CoordPosEncoding

**File:** `func_yolo_layers.py` | `tatr_builder.py`  
**Purpose:** Appends normalised 2D coordinate maps (x, y ∈ [-1, 1]) as additional channels before a convolution. This provides explicit position information, which is valuable for table-grid layouts where structure is inherently position-dependent.

#### YOLO — `CoordConv`

Wraps an existing `Conv2d` to prepend coordinate channels:

```python
class CoordConv(nn.Module):
    def __init__(self, in_channels, out_channels, with_r=False):
        extra = 3 if with_r else 2
        self.addcoords = AddCoords(with_r=with_r)
        self.conv = nn.Conv2d(in_channels + extra, out_channels, ...)
```

#### TATR — `CoordPosEncoding`

A standalone module that concatenates coords before any downstream layer:

```python
class CoordPosEncoding(nn.Module):
    def __init__(self, with_r=False, lambda_coord=1.0):
        ...
    def forward(self, x):
        xx = linspace(-1,1,W), yy = linspace(-1,1,H)
        coords = cat([xx, yy], dim=1) * self.lambda_coord
        return cat([x, coords], dim=1)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `with_r` | `bool` | `False` | Also append radial distance channel `r = √(x²+y²)`. |
| `lambda_coord` | `float` | `1.0` | *(TATR)* Blend strength of coordinate channels. |

---

### 2.6 EnhancedBlock

**File:** `func_yolo_layers.py` | `tatr_builder.py`  
**Purpose:** A composite block that sequentially applies CBAM → LiteTransformer → BiFPN after any backbone/neck layer. Each submodule can be independently enabled or disabled.

#### Class definition

```python
class EnhancedBlock(nn.Module):
    def __init__(self, channels, use_cbam=False, use_transformer=False, use_bifpn=False):
        if use_cbam:
            self.cbam = CBAM(channels)
        if use_transformer:
            nhead = 4 if channels <= 128 else 8
            dim_ff = channels * 2
            self.transformer = LiteTransformerBlock(channels, nhead=nhead, dim_feedforward=dim_ff)
        if use_bifpn:
            self.bifpn = BiFPN_Block(...)
    def forward(self, x):
        if self.cbam:        x = self.cbam(x)
        if self.transformer: x = self.transformer(x)
        if self.bifpn:       x = self.bifpn(x)  # only when x is a list
        return x
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `channels` | `int` | *(required)* | Feature channel count at the insertion point. |
| `use_cbam` | `bool` | `False` | Enable CBAM attention. |
| `use_transformer` | `bool` | `False` | Enable LiteTransformerBlock. |
| `use_bifpn` | `bool` | `False` | Enable BiFPN feature fusion (requires list input). |

---

### 2.7 BiFPN (Bi-directional FPN)

**File:** `func_yolo_layers.py` | `tatr_builder.py`  
**Purpose:** Learnable, weighted bi-directional feature pyramid network for fusing multi-scale CNN features before the detection head, improving detection at different table granularities.

```python
class BiFPN_simple(nn.Module):
    def __init__(self, channels_list, eps=1e-4):
        self.weights = nn.ParameterList(...)   # Learnable fusion weights
        self.convs   = nn.ModuleList([nn.Conv2d(c, c, 3, padding=1) for c in channels_list])
        self.upsample   = nn.Upsample(scale_factor=2, mode='nearest')
        self.downsample = nn.MaxPool2d(2, 2)
```

---

## 3. YOLOv11 Enhanced Architecture

### 3.1 Integration Points

The `build_yolo_enhanced` function in `yolo_builder.py` dynamically inserts enhancement modules at specific **layer indices** within the YOLOv11 model graph.

```
Input Image
    │
    ▼
[0] PreBackboneFreqFilter          ← FreqFilter2D wraps first backbone Conv
    │
    ▼ (Backbone layers 1–16)
[10] C2PSA (Self-Attention)
    │
    ▼
[16] PreNeckCoordConv              ← CoordConv inserted between backbone and neck
    │
    ▼
[17] EnhancedBlockWrapper          ← CBAM + LiteTransformer (64 ch)
    │
    ▼
[18] BRMWrapper                    ← BRM (192 ch, concat output)
    │
    ▼
[19] BRMWrapper                    ← BRM (128 ch)
    │
    ▼
[20] EnhancedBlockWrapper          ← CBAM + LiteTransformer (128 ch)
    │
    ▼
[21] BRMWrapper                    ← BRM (384 ch, concat output)
    │
    ▼
[22] EnhancedBlockWrapper          ← CBAM + LiteTransformer (256 ch)
    │
    ▼
[23] EdgeAugmentedDetect           ← Detection head + MultiScaleEdgeHead
```

### 3.2 Wrappers

| Wrapper | Purpose |
|---|---|
| `PreBackboneFreqFilter` | Wraps the first backbone layer; applies `FreqFilter2D` then the original layer |
| `PreNeckCoordConv` | Wraps the pre-neck layer; applies `CoordConv` then the original layer |
| `BRMWrapper` | Wraps any neck layer; applies the original layer then `BRM` |
| `EnhancedBlockWrapper` | Wraps any backbone/neck layer; applies original then `EnhancedBlock` |
| `EdgeAugmentedDetect` | Wraps the detection `Detect` head; adds a `MultiScaleEdgeHead` |

### 3.3 Builder Function & Version Configurations

**Function:** `build_yolo_enhanced` in `yolo_builder.py`

```python
def build_yolo_enhanced(
    base_ckpt,              # Path to YOLOv11 base checkpoint (.pt)
    device,                 # torch.device
    apply_freq_filter=False,
    apply_coord_conv=False,
    apply_brm=False,
    apply_edge_head=False,
    apply_enhanced_blocks=False,
    pre_neck_idx=16,        # Model index where CoordConv is inserted
    version_enhanced=None,
    apply_cbam=False,
    apply_litetransformer=False,
    apply_bifpn=False
)
```

**Version matrix** (from `yolo_train_enhanced.py`):

| Version | FreqFilter2D | CoordConv | BRM | Edge Head | Enhanced Blocks | CBAM | LT | BiFPN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| V0 (baseline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| V1 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| V2 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| V3 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| V4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| V5 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| V6 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| V7 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| V8 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |

### 3.4 Training Hyperparameters

From `yolo_train_enhanced.py`:

| Parameter | Value |
|---|---|
| Base checkpoint | `yolo11n.pt` |
| Optimizer | AdamW |
| Learning rate (`lr0`) | `5e-5` |
| LR final ratio (`lrf`) | `0.01` |
| LR scheduler | Cosine |
| Warmup epochs | 5 |
| Epochs (max) | 500 |
| Batch size | 128 |
| Image size | 640 × 640 |
| Early stopping patience | 15 |
| Weight decay | `1e-4` |
| Gradient clip (`max_norm`) | 1.0 |
| AMP (mixed precision) | ✅ |
| Box loss weight | 5.0 |
| Class loss weight | 0.3 |
| DFL loss weight | 1.5 |
| Dropout | 0.2 |

**Data augmentation:**

| Augmentation | Value |
|---|---|
| Degrees (rotation) | 10° |
| Translate | 0.1 |
| Scale | 0.5 |
| Shear | 0.1 |
| Perspective | 0.0005 |
| Flip UD | 0.3 |
| Flip LR | 0.5 |
| HSV-H | 0.02 |
| HSV-S | 0.8 |
| HSV-V | 0.5 |
| Erasing | 0.4 |
| Mosaic | Disabled |

---

## 4. TATR Enhanced Architecture

The base model is `microsoft/table-transformer-structure-recognition`, a DETR-style detector with a **ResNet50 CNN backbone** followed by a **Transformer encoder-decoder**.

### 4.1 Integration Points

```
Input Image
    │
    ▼
conv1 (ResNet50, 3→64)
    │  ← FreqFilter2D wraps this conv (LoRACompatibleConvWithFreqFilter)
    │  ← CoordPosEncoding prepended (total input: 5 ch)
    ▼
bn1 → relu → maxpool
    │  ← LiteTransformerBlock attached (bn1 stage)
    ▼
layer1 (ResNet50 block group)
    │  ← LiteTransformerBlock attached (layer1 and layer1.0 stages)
    │  ← CBAM attached (layer1.cbam.sa.conv)
    ▼
layer2  ← CBAM (layer2.cbam.sa.conv)
    ▼
layer3  ← CBAM (layer3.cbam.sa.conv)
    ▼
layer4  ← CBAM (layer4.cbam.sa.conv)
    ▼
Transformer Encoder (6 layers)
    │  [encoder.layers.0-5 → self_attn: q, k, v, out projections]
    ▼
Transformer Decoder (6 cross-attn layers)
    │  [decoder.layers.0-2 → encoder_attn.q_proj]
    │
    ▼
Decoder output
    │  ← BRM applied to decoder output features (DecoderBRMWrapper)
    ▼
class_labels_classifier + bbox_predictor (3-layer MLP)
```

### 4.2 Wrappers

| Wrapper | Purpose |
|---|---|
| `LoRACompatibleConvWithFreqFilter` | Inherits from `nn.Conv2d` for PEFT compatibility; applies `FreqFilter2D` before the convolution forward pass |
| `PreConvFreqFilter` | Standalone sequential wrapper: `FreqFilter2D → Conv2d` |
| `PreConvCoord` | Standalone sequential wrapper: `CoordPosEncoding → Conv2d` |
| `CoordThenFreq` | Chained wrapper: `CoordPosEncoding → FreqFilter2D → Conv2d` |
| `EnhancedBlockWrapper` | Applies CBAM and/or LiteTransformerBlock after any CNN layer |
| `DecoderBRMWrapper` | Wraps the DETR decoder; applies BRM to `pred_feats` if present in output dict |

### 4.3 Builder Function & Version Configurations

**Function:** `build_tatr` in `tatr_builder.py`

The TATR builder applies modules according to the `version` argument:

| Version | FreqFilter2D | CoordConv | LiteTransformer | BRM (Decoder) | CBAM |
|---|:---:|:---:|:---:|:---:|:---:|
| V0 (baseline) | ❌ | ❌ | ❌ | ❌ | ❌ |
| V1 | ✅ | ❌ | ❌ | ❌ | ❌ |
| V2 | ✅ | ✅ | ❌ | ❌ | ❌ |
| V3 | ✅ | ✅ | ❌ | ✅ | ❌ |
| V4 | ✅ | ✅ | ❌ | ✅ | ✅ |
| V5 | ✅ | ✅ | ✅ | ✅ | ❌ |
| V6 | ✅ | ❌ | ✅ | ❌ | ❌ |
| V7 | ✅ | ❌ | ✅ | ✅ | ❌ |
| V8 | ✅ | ❌ | ❌ | ❌ | ✅ |

Key builder helpers:

```python
build_tatr_freq_filter(model, device, params)
    # Wraps ResNet50 conv1 with LoRACompatibleConvWithFreqFilter
    # params: {'cutoff_ratio': 0.15, 'lambda_filter': 1.0}

build_tatr_coord(model, device, params)
    # Prepends CoordPosEncoding to conv1; adjusts conv to 5-channel input
    # params: {'lambda_coord': 1.0, 'with_r': False}

build_tatr_lite_transformer(model, device, params)
    # Attaches LiteTransformerBlock to conv1, bn1, layer1, layer1.0
    # params: {'channels': 64}

build_tatr_brm(model, device, params)
    # Wraps TATR decoder with DecoderBRMWrapper
    # params: {'channels': <decoder output channels>}

build_tatr_cbam(model, device, params)
    # Attaches CBAM to layer1–layer4 of ResNet50
```

### 4.4 Training Hyperparameters

From `tatr_train_enhanced.py`:

| Parameter | Value |
|---|---|
| Base model | `microsoft/table-transformer-structure-recognition` |
| Optimizer | AdamW |
| Learning rate (no LoRA) | `5e-5` |
| Learning rate (with LoRA) | `1e-3` |
| LR scheduler | Cosine |
| Epochs (max) | 500 |
| Batch size (train) | 16 (per device) |
| Gradient accumulation steps | 4 |
| Gradient clip (`max_grad_norm`) | 0.01 |
| Early stopping patience | 10 |
| Weight decay | `1e-5` |
| Image size | 800 × 800 |
| Mixed precision (fp16) | ✅ (only when LoRA is active) |
| Eval strategy | Every epoch |
| Best model metric | `eval_loss` (lower is better) |

---

## 5. LoRA Fine-Tuning Strategy

LoRA (Low-Rank Adaptation) freezes the original pre-trained weights and injects small trainable rank-decomposition matrices `A` and `B` such that the effective weight update is:

```
ΔW = B × A,   rank(ΔW) = r  ≪  min(d_in, d_out)
```

This reduces the number of trainable parameters significantly, which is critical when fine-tuning on domain-specific data (legacy certificates) without overfitting.

### 5.1 YOLO LoRA — In-Place Parameter Injection

**Implementation approach:** Because the Ultralytics framework rebuilds the model graph during training, standard PEFT wrappers cannot be applied transparently. Instead, LoRA matrices are **injected directly into the `Conv2d` layers** as additional trainable parameters, while the base weights are frozen.

- All base YOLO weights → `requires_grad = False`
- LoRA target `Conv2d` weights → `requires_grad = True`
- An **anti-rebuild patch** (`apply_ultralytics_patch`) is applied to prevent Ultralytics from resetting the custom architecture during `model.train()`

**LoRA hyperparameters (YOLO):**

| Parameter | Value |
|---|---|
| `r` (rank) | 16 |
| `lora_alpha` | 32 |
| `lora_dropout` | 0.05 |

### 5.2 TATR LoRA — PEFT Library Integration

**Implementation approach:** Because TATR is built on Hugging Face Transformers, the official **PEFT (`peft`) library** is used directly:

```python
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=LORA_R,                       # 16
    lora_alpha=LORA_ALPHA,          # 32
    target_modules=LORA_TARGET_MODULES,  # version-specific list
    lora_dropout=LORA_DROPOUT,      # 0.05
    bias="none",
)

model = get_peft_model(model, lora_config)
```

When LoRA is **not** active, the backbone (ResNet50) is **fully frozen**:

```python
for name, param in model.model.backbone.named_parameters():
    param.requires_grad = False
```

**LoRA hyperparameters (TATR):**

| Parameter | Value |
|---|---|
| `r` (rank) | 16 |
| `lora_alpha` | 32 |
| `lora_dropout` | 0.05 |
| `bias` | `"none"` |

### 5.3 LoRA Target Modules Reference

The target module lists are defined per version in `yolo_lora_config.py` and `tatr_lora_config.py`. Each version adds the layers corresponding to the newly integrated modules, in a cumulative fashion.

---

#### YOLO LoRA Target Modules

| Version | Description | Key Target Module Groups |
|---|---|---|
| V0 | Baseline | C2PSA self-attention (`qkv`, `proj`), neck `cv2` |
| V1 | + FreqFilter2D + CoordConv | V0 + `model.0.first_layer.conv`, `model.16.coordconv.conv` |
| V2 | + BRM | V1 + BRM `conv1`/`conv2` at indices 18, 19, 21 |
| V3 | + Edge Head | V2 + `edge_head.edge_heads.0.conv1/conv2/conv_out` |
| V4 | + Enhanced Block (CBAM+LT) | V3 + CBAM spatial convs + LT `proj_in`/`proj_out` at idx 17, 20 |
| V5 | FreqFilter2D+CoordConv+EnhBlk(CBAM+LT+BiFPN) | Freq+Coord+CBAM+LT at idx 17, 20 |
| V6 | + CBAM only | Freq+Coord+CBAM spatial convs |
| V7 | + BRM + CBAM | Freq+Coord+CBAM+BRM at idx 18, 19, 21 |
| V8 | + CBAM + LT | Freq+Coord+CBAM+LT at idx 17, 20 |

**Key YOLO module paths:**

```
# Self-Attention (C2PSA block)
model.10.m.0.attn.qkv.conv
model.10.m.0.attn.proj.conv

# FreqFilter2D (pre-backbone)
model.model.0.first_layer.conv

# CoordConv (pre-neck, layer 16)
model.16.coordconv.conv

# Neck spatial refinement conv
model.13.cv2.conv

# BRM at neck stages 18, 19, 21
model.{18,19,21}.brm.conv1
model.{18,19,21}.brm.conv2

# EnhancedBlock CBAM spatial attention (idx 17, 20)
model.{17,20}.enhanced.cbam.spatial_attention.conv

# EnhancedBlock LiteTransformer projections (idx 17, 20)
model.{17,20}.enhanced.transformer.proj_in
model.{17,20}.enhanced.transformer.proj_out

# Edge Head (first scale)
model.23.edge_head.edge_heads.0.conv1
model.23.edge_head.edge_heads.0.conv2
model.23.edge_head.edge_heads.0.conv_out
```

---

#### TATR LoRA Target Modules

| Version | Description | Key Target Module Groups |
|---|---|---|
| V0 | Baseline | ResNet50 layer3/4 conv1, encoder self-attn (q/k/v/out), decoder cross-attn q, classifiers |
| V1 | + FreqFilter2D | V0 + `conv1.conv` (inside freq wrapper) |
| V2 | + CoordConv (conv wrapper) | V1 + `conv1.conv` (duplicate entry for wrapper) |
| V3 | + BRM | V2 + `decoder.brm.conv1/conv2` |
| V4 | + CBAM | V3 + `layer{1-4}.cbam.sa.conv` |
| V5 | + LiteTransformer | V3 + LT proj/attn/linear at conv1, bn1, layer1, layer1.0 |
| V6 | + LiteTransformer (no BRM) | Freq+LT at conv1, bn1, layer1, layer1.0 |
| V7 | + BRM + LiteTransformer | BRM+LT at conv1, bn1, layer1, layer1.0 |
| V8 | + CBAM (no LT) | Freq+CBAM spatial at layer1-4 |

**Key TATR module paths:**

```
# ResNet50 backbone conv1 (inside freq/coord wrapper)
model.backbone.conv_encoder.model.conv1.conv

# ResNet50 semantic layers
model.backbone.conv_encoder.model.layer4.0.conv1
model.backbone.conv_encoder.model.layer4.1.conv1
model.backbone.conv_encoder.model.layer3.0.conv1
model.backbone.conv_encoder.model.layer3.1.conv1

# Transformer Encoder self-attention (layers 0–5)
model.encoder.layers.{0-5}.self_attn.{q,k,v,out}_proj

# Transformer Decoder cross-attention (layers 0–2)
model.decoder.layers.{0-2}.encoder_attn.q_proj

# Classifiers and bounding-box MLP
class_labels_classifier
bbox_predictor.layers.{0,1,2}

# BRM inside decoder
model.decoder.brm.conv1
model.decoder.brm.conv2

# CBAM spatial attention inside ResNet50 blocks
model.backbone.conv_encoder.model.layer{1-4}.cbam.sa.conv

# LiteTransformer projections at conv1, bn1, layer1, layer1.0
model.backbone.conv_encoder.model.conv1.lite.proj_in
model.backbone.conv_encoder.model.conv1.lite.encoder_layer.self_attn.out_proj
model.backbone.conv_encoder.model.conv1.lite.encoder_layer.linear1
model.backbone.conv_encoder.model.conv1.lite.encoder_layer.linear2
model.backbone.conv_encoder.model.conv1.lite.proj_out
# (same pattern repeated for bn1, layer1, layer1.0)
```

---

*End of Architecture Modules and Configurations document.*
