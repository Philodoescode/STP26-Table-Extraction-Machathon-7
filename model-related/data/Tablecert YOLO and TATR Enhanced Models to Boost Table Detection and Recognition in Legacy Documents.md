# Tablecert: YOLO and TATR Enhanced Models to Boost Table Detection and Recognition in Legacy Documents

Patrick Ferreira Barroso

pbarroso@inmetro.gov.br

National Institute of Metrology, Quality and Technology (INMETRO)

Wilson de Souza Melo Junior

National Institute of Metrology, Quality and Technology (INMETRO)

Rodrigo Pereira David

National Institute of Metrology, Quality and Technology (INMETRO)

Luiz Fernando Rust da Costa Carmo

National Institute of Metrology, Quality and Technology (INMETRO)

# Research Article

Keywords: Computer Vision,Deep Learning, Digital Calibration Certificates,Digital Transformation for Metrology, Fine-Tuning, Low-Rank Adaptation

Posted Date: February 16th, 2026

DOl: https://doi.0rg/10.21203/rs.3.rs-8864429/v1

License: @ ④ This work is licensed under a Creative Commons Attribution 4.0 International License. Read Full License

Additional Declarations: The authors declare no competing interests.

# Tablecert: YOLO and TATR Enhanced Models to Boost Table Detection and Recognition in Legacy Documents

Patrick Ferreira Barroso1，Wilson de Souza Melo Junior1， RodrigoPereira David1， Luiz Fernando Rust da Costa Carmo1

1National Institute of Metrology, Quality and Technology (INMETRO), Av. Nossa Sra. das Gracas, 5O - Xerém, Duque de Caxias, CEP 25250-020,Rio de Janeiro, Brazil.

Contributing authors: pbarroso@inmetro.gov.br; wsjunior@inmetro.gov.br; rpdavid@inmetro.gov.br; lfrust@inmetro.gov.br;

# Abstract

The digital transformation of legacy documents remains challenging,as these documents are often unstructured and contain complex table layouts (e.g., watermarks,spaced headers，closely spaced tables，nested structures,and double borders) that degrade the performance of conventional table detection and recognition systems.We propose a modular,plug-and-play adaptation framework for YOLO-based table detection and Table Transformer (TATR)-based structure recognition,combining parameter-efficient LoRA fine-tuning with lightweight architectural modules (e.g., frequency-domain filtering and structural refinements). We evaluate the framework on a dataset of calibration certificates using a controlled training and evaluation protocol with standard detection and structure metrics. The adapted models outperform their respective baselines,mitigating layout-related challenges,and achieve F1-scores of 0.9999（YOLO） and 0.9640 (TATR),alongside reduced validation loss. The best YOLO adaptation improves robustness in table detection under challenging visual artifacts,whereas the TATR-V6 yields stronger structural recognition. Finally, we show that the proposed FreqFilter2D module is a promising drop-in component for other computer vision architectures.

Keywords:Computer Vision,Deep Learning,Digital Calibration Certificates,Digital Transformation for Metrology,Fine-Tuning, Low-Rank Adaptation.

# 1 Introduction

Digital Transformation (DT） represents a global milestone driven by the adoption of cutting-edge digital technologies to achieve significant improvements in opera-tions and markets. Key impacts include enhancing customer experiences, streamlining operational processes,and developing innovative business models [31]. DT has also introduced new social, professional, and personal perspectives, profoundly affecting lifestyles,daily habits,and the way companies operate [13]. In an increasingly competi-tive environment shaped by DT,organizations must ensure high quality, transparency, and security in their services and products.

Electronic documents have become essential for storing and sharing knowledge in DT initiatives,enabling greater accessbility and automation of routine tasks. In this context, PDF files are widely used across sectors-ranging from academia and healthcare to government and industry—due to their portability and layout preservation. However, complex PDFs still pose major challenges for extracting structured information. Many documents contain tables,graphs,and heterogeneous layouts,which complicates reliable automated data retrieval, especially when large volumes must be processed efficiently.

In metrology, such challenges observed in legacy documents are also evident in calibration certificates, technical documents that presents the results of a rigorous calibration process used to verify the quality and measurement performance of instruments. The calibration process among National Metrology Institutes (NMIs) is often non-standardized due to the unique characteristics of each laboratory, different management structures, diverse measurands,and varying measurement systems [15]. This heterogeneity results in certificates with highly varied layouts and table structures.

Computer Vision (CV) has emerged as a promising area for developing AI models capable of extracting complex components from electronic documents [42]. Although traditional rule-based and heuristic methods [39,1] can be effective for specific templates, they are typically not robust enough to handle the diversity of formats and styles found in complex files.For tabular data, modern CV models rely on deep learning approaches [16,32] to detect and segment tables,enabling conversion into machine-parsable formats. Recent advances include architectures such as Convolutional Neural Networks (CNNs) [11] and transformers [5,25], which have demonstrated strong performance in table detection and recognition.

As a first contribution of this work,we extend a previously published benchmarking study on state-of-the-art table detection and recognition models [2].Building on an initial evaluation conducted on instrument calibration certificates,the present work expands the analysis to include newly models [55, 58,25,10, 28,41, 40, 52]. The updated benchmarking confirms that strong performance can be achieved by combining table detection models-such as YOLO (You Only Look Once)—with table structure and recognition models-such as the Table Transformer (TATR). Additionally,the evaluation highlights persistent and newly observed challenges, including double borders,closely spaced tables, watermarks, spaced headers,and nested tables.

Motivated by the limitations identified during the benchmarking phase, this work proposes Tablecert,a architectural framework that provided enhancements for YOLOv1l and TATR combined with a parameter-efficient fine-tuning strategy based

on Low-Rank Adaptation (LoRA),aiming to improve table detection and structure recognition in calibration certificates-documents characterized by complex tabular layouts identified during benchmarking.

The enhanced YOLOv11 and TATR models introduce a hybrid spatial-frequency strategy with local and global attention mechanisms that integrate spectral filter-ing,explicit spatial alignment,and weighted multi-scale fusion.In addition,LoRA is applied to selected layers of the adapted architectures, freezing non-impacted layers to improve efficiency and stability. The main contributions of this work are as follows:

· Updated benchmarking of state-of-the-art models for table detection and recognition conducted on a use-case dataset of calibration certificate documents.   
·A modular architectural adaptation framework for YOLO and TATR models (TableCert1),implemented via a dynamic plug-and-play builder and LoRA-based fine-tuning strategies to address gaps identified during benchmarking.   
·A Table Extraction Assessment Method for Calibration Certificates (TEAM-CC) and software (BMTABLEMODELS²) to establish a quality-metric evaluation framework for table detection and recognition,and to provide an automated pipeline for applying this framework using pretrained models.   
· Results assessment from both training and prediction perspectives.

The paper is structured as follows: (i) Introduction; (ii) Background, covering DT and CV, structural feature representation modules, fine-tuning and LoRA,and related works; (ii) Benchmarking of table detection and recognition models; (iv) Tablecert's framework methodology and implementation; (v) Results; (vi) Conclusion,limitations, and future work; and (vii) Bibliographical references.

# 2 Background

# 2.1 Digital Transformation and Computer Vision

Digital Transformation (DT) has brought profound changes to companies worldwide, driven by the imperative to meet customer demands with enhanced quality and intelli-gence.This shift demands structural improvements to accommodate the digital format, involving substantial investments in information security, process optimization, digital channels,web portals,and mobile applications. DT is a process aimed at improving an entity by initiating significant changes in its characteristics through integrating information, computing, communication,and connectivity technologies [44].

DT drives eficiency， data-driven decision-making,and service innovation. In document digitalization processing, the need for intelligent solutions that can interpret,organize,and extract information accurately and at scale grows,especially in corporate, legal, and government environments.

In this context,Computer Vision (CV） stands out as one of the most promis-ing areas of artificial intelligence, allowing machines to interpret and understand visual data, such as images and scanned documents. Modern techniques based on

convolutional neural networks (CNNs） [11] and transformers [5,25] have demonstrated impressive results in tasks such as table detection, optical character recognition (OCR)，and semantic segmentation. These approaches surpass traditional heuristic and rule-based methods [39,1] by offering greater robustness in the face of the variability of formats, noise,and complex document layouts.

CV also has become a crucial tool for the DT process by developing models for automating the extraction of information from complex documents,such as calibration certificates.By leveraging deep learning techniques,these models can detect structures such as tables, forms,and handwritten annotations,enabling accurate data retrieval from documents with diverse layouts [38]. CV models can drive the DT process in metrology, mainly collecting accurate data in calibration certificates to apply to standardized formats,such as the Digital Calibration Certificate (DCC) [17].

# 2.2 Structural Feature Representation Modules

# 2.2.1 Frequency filter-based module (FreqFilter2D)

A frequency filter-based module explores the use of spectral representations to enhance feature extraction and suppress structural noise—an essential requirement for digitized documents that contain watermarks, irregular textures,and scanning artifacts. Tabular structures exhibit spatial periodicity (parallel and equidistant lines),which makes them easily identifiable in the frequency domain. The use of spectral flters improves the robustness against noise and distortions, since the global structure of the table is preserved in the spectrum.

The frequency filter-based module is based on Adaptive Frequency Filtering Token Mixer (AFF) [20], which projects activations into the Fourier domain,applying adaptive filtering,and reconverting them back into the spatial domain functions as a highly efficient global token mixer,serving as an alternative to high-cost attention mechanisms.This line of research reinforces the feasibility of learnable spectral filters and directly inspires the design of FreqFilter2D.

Band-limited CNNs[12] show that restricting the processed frequency band increases stability,reduces noise,and controls spectral complexity, providing additional theoretical support for incorporating spectral modules into convolutional pipelines. Similarly, Fourier CNNs [18],and classcal FCNN architectures confirm that Fourierdomain convolutions are mathematically equivalent to spatial convolutions,while being more efficient and better suited to capturing global structures.

Hybrid literature, such as FSFF-Net [33], demonstrates that the fusion of spatial and spectral features substantially improves performance on complex classification and detection tasks,validating the complementarity between frequency-domain filters and CNN/Transformer architectures. Similarly to the use of wavelets [9], transitioning to alternative domains enables more granular filtering of structural patterns.

# 2.2.2 Coordinate Convolution Positioning (CoordConv)

Traditional convolution is translationally invariant,which makes tasks that rely on absolute spatial location inherently challenging. [26] demonstrated that conventional CNNs struggle to learn mappings that depend directly on the physical positions of

pixels, such as bounding-box regression, spatial transformation,and the identification of complex layouts.

Coordinate Convolution Positioning (CoordConv) addresses this limitation by concatenating explicit coordinate maps to the input channels,enabling the network to learn absolute spatial relationships directly. This module has been applied across a wide range of computer vision tasks that require precise mapping of complex structures, including instance segmentation [53], sonar detection and underwater robotics, heatmap regression for facial alignment [46],modern detection pipelines [43],and spatial-attention architectures [7].

CoordConv introduces additional convolutional channels containing normalized spatial coordinates, enabling convolutional networks to encode explicit positional information that is otherwise diffcult to infer solely through standard translation-invariant convolutions. By providing direct access to the absolute position， CoordConv substantially improves geometric regresson and reduces spatial ambiguity in tasks where location matters.

In the context of tabular structures,CoordConv can also be adapted to mitigate issues such as narrow or disproportionate columns, large or displaced headers,and closely positioned tables by allowing the network to model positional dependencies more accurately. This explicit encoding of spatial coordinates improves the network's ability to distinguish and localize structurally similar components that difer primarily in spatial arrangement.

# 2.2.3 Boundary Refinement Module (BRM)

Table detection and structural elements in documents critically depend on the model's ability to accurately preserve boundary information such as thin borders, ruling lines, headers, and separators. Table detection and document-structure recognition critically depend on the ability to preserve boundary information (e.g., thin ruling lines, headers, separators,and table borders). Boundary Refinement Modules (BRMs) are designed to recover these fine-grained details and mitigate the loss of spatial precision introduced by downsampling operations.

Boundary Refinement Module (BRM) is grounded on boundary-aware representation learning. RefineNet [23] introduced multi-path refinement strategies to efectively recover fine-grained contours by fusing low-level and high-level feature representations. Building upon this paradigm, BASNet [37] demonstrated the effectiveness of contourdriven predict-refine mechanisms supported by explicit boundary supervision. More recent approaches,such as MBR-HRNet [50], further extend these concepts by incorporating multi-scale refinement schemes and dedicated boundary-supervision branches. Inspired by these works,the proposed BRM adopts structured boundary modeling to enhance contour localization and improve structural consistency.

Empirical evidence from domains such as remote sensing [54], camouflage detec-tion [14],and video object segmentation [35] highlights the substantial gains provided by BRMs. These modules consistently improve boundary-sensitive metrics,such as Boundary IoU [6], while reducing localization errors in regions where structural details are most critical.

In the context of tables and calibration certificates - documents characterized by parallel lines, narrow cells, signatures,and stamps that introduce structural noise - BRM can be applied to enhance boundary regression and restore contours that are often degraded by backbone feature extraction.

# 2.2.4 Convolutional Block Attention Module (CBAM)

The Convolutional Block Attention Module (CBAM） [47] introduces a lightweight yet highly effective attention mechanism composed of a sequential channel-attention stage followed by a spatial-attention stage.This architecture enhances feature representations by emphasizing what is relevant through channel attention and where it is relevant through spatial attention, while adding only minimal computational overhead. Subsequent research has demonstrated the effectiveness of CBAM across multiple tasks, including aerial object detection [60, 45], change detection and remote sensing, semantic segmentation [61], industrial defect detection, integration with Transformerbased models [57],and human activity recognition based on sensor data. Its sequential channel-spatial design has proven more effective than parallel variants,and its modular nature enables seamless integration as a plug-in at various stages of convolutional or hybrid architectures.

In the context of table detection and recognition, CBAM can be a promising component,as it is expected to adaptively enhance line structures and cell boundaries, suppress noise and irrelevant regions, improve bounding-box regression,and reinforce structural relationships in complex document layouts. By operating on localized spatial relations and channel-specific activations, CBAM efectively highlights functional boundaries between adjacent regions, learning subtle differences in structural patterns such as spacing,border style,or alignment.Even when two tables are placed in close proximity, the spatial-attention mechanism can successfully separate the correspond-ing regions of interest, improving local discrimination and preventing the model from erroneously interpreting multiple tables as a single structure.

# 2.2.5 Lightweight Transformer (Lite Transformer)

To incorporate global dependency modeling while maintaining low computational overhead, several studies have proposed lightweight transformer architectures (Lite Transformers) that balance efficiency and representational capacity. A notable example is the Lite Transformer with Long-Short Range Attention (LSRA) introduced by [49],which decomposes self-attention into two specialized branches: one focused on local context modeling via convolutional operations,and another dedicated to capturing long-range dependencies through standard self-attention. This design significantly reduces computational cost and memory consumption while preserving competitive performance, originally demonstrated in natural language processing tasks.

The importance of computational efficiency has motivated the adoption of lite transformers in resource-constrained scenarios such as fine-tuning,server-side inference,and deployment on edge or low-power devices.In such settings,reducing time, memory， and energy consumption becomes critical, particularly when the model pipeline already integrates multiple auxiliary components.Lite transformer modules

provide an effective solution by introducing contextual reasoning without substantially increasing model complexity.

In the vision domain, several works have extended this paradigm. [51] proposed the Lite Vision Transformer (LVT),which introduces Convolutional Self-Attention (CSA) to capture local spatial patterns in early layers,and Recursive Atrous Self-Attention (RASA) to model multi-scale global context in deeper stages. This combination allows LVT to achieve strong performance across image classfication, semantic segmentation, and panoptic segmentation tasks while maintaining a favorable accuracy-efficiency trade-off. Similarly, [56] introduced Lite-Mono,a lightweight hybrid CNN-Transformer architecture for self-supervised monocular depth estimation. Their design combines multi-scale dilated convolutions for local feature extraction with a local-global feature interaction module based on attention,resulting in approximately 80% fewer parameters compared to heavier Transformer-based models,while retaining competitive accuracy.

These studies collectively demonstrate that lite transformers can effectively balance local feature modeling and global dependency capture, which is particularly relevant for structured visual data.In the context of table understanding,local patterns such as lines,borders,and cell boundaries must be analyzed alongside global structural relationships that define table layouts.

# 2.3 Fine-tuning and LoRA

Fine-tuning is the process of adapting a pre-trained machine learning model to a specific task or particular dataset by leveraging the knowledge already acquired during its initial training on a large general dataset. While maintaining the model's general comprehension capabilities, it is adapted to specific domain applications [8,48]. Instead of training a model from scratch, fine-tuning makes additional adjustments with more specific data to improve the model's performance and accuracy on the desired task. To avoid wasting computational resources, it is most effective to adjust only specific layers or weights while keeping the rest of the model intact. One of the most efficient approaches in this regard is parameter-efficient fine-tuning (PEFT) [29],which optimizes the adaptation process by selectively modifying parameters without extensive retraining.

PEFT is an advanced fine-tuning technique designed to effciently adjust large models by modifying only a small subset of the model's parameters [48]. This approach involves freezing the primary weights, keeping them unchanged, and focusing adjustments on specific layers or additional parameters.The main PEFT techniques include adapters,which are small intermediate layers added to capture task-specific knowledge; prefix tuning,which introduces additional tokens at the beginning of the input sequence to adapt the model's behavior;and Low-Rank Adaptation (LoRA),a method that reduces the complexity of model adjustments by introducing low-rank matrices to modify specific layers.

According to [19], LoRA is a specific PEFT technique that focuses on adapting large models by reducing the complexity of adjustments. Instead of directly modifying the entire model's weights, LoRA introduces the concept of low-rank matrices to adapt the weights of specific model layers during fine-tuning.

Rank refers to the reduced dimension used to decompose the weight matrices of a neural model into lower-dimensional matrices that controls the extent of adaptation of these reduced matrices.By decomposing weight matrices into lower-dimensional representations,LoRA minimizes the number of parameters that need to be adjusted and stored during fine-tuning, thereby enhancing computational resource sustainability in the deep learning model training process.

While LoRA-based fine-tuning has shown promise in domains like image detection and transformer adaptation [36, 27, 3], its use for document-centric table extraction remains largely uncharted. Existing works have not yet examined LoRA's potential in adapting table extraction models (e.g.， YOLO for table detection and TATR for table structure recognition） to highly heterogeneous, domain-specific documents such as calibration certificates.

# 3 Table Detection and Recognition Models Benchmarking

# 3.1 Models Selection Strategy

The initial step of the present proposal involved benchmarking state-of-the-art models specialized in table detection (TD） and table structure recognition (TSR） using a dataset of calibration certificate documents, in order to identify candidates suitable for fine-tuning and architectural enhancement. The benchmarking study evaluated pretrained models that, during prediction operations, provide contour pixel coordinates for the TD task and cell coordinates for the TSR task. Both types of coordinates are presented in the [x1，y1,x2,y2] format,where (x1，y1) denotes the bottom-left corner and (x2,y2） denotes the top-right corner of the table or cell. This coordinate representation is commonly referred to as a bounding box (bbox).

Although not the focus of benchmarking and this study, table content recognition（TCR） was performed using EasyOCR library for YOLO, TATR,and DETR models,with text extracted based on bounding box coordinates predicted by the models during inference,except for Unitable and TableMaster models,which perform TCR task. Benchmarking included TCR tasks to qualitatively assess whether the extracted information remained within the predicted boundaries of the models, detailed in [55,58,25,10, 28, 41, 40, 52,4,34] (Table 1).

TD involves identifying the presence and boundaries of tables within a document. This process is essential for locating tables in various formats, including PDFs, images, scanned documents,and web pages. TSR pertains to comprehending the internal organization of the detected tables. TSR encompasses the identification of rows,columns, cels,headers,and the hierarchical relationships among them. This task is more com-plex due to the diverse and non-standardized structures that tables may exhibit. TCR focuses on extracting and interpreting the data contained within table cells.It includes Optical Character Recognition (OCR） for text conversion，determining data types (such as numbers,text, dates,etc.),and contextualizing content based on the table's structure.

Table 1: Table Extraction Models Evaluated In The Experiment   
![](images/6a36bd6c53d02f8f8a607102a96c4dfcddc47dec1596d295f809e2547f31765e.jpg)

YOLOv11 is a general-purpose object detection model designed to identify multiple object classes in documents and images； however, it is not natively specialized for table detection. To enable its inclusion in the benchmarking,the model was previously fine-tuned using the Pub Tables-1M dataset ([41]).

# 3.2 Metrics Definition and Results

This study developed the Table Extraction Assessment Method for Calibration Certifcates (TEAM-CC),utilizing a supporting software tool named BMTABLEMODELS to automate the evaluation of benchmarking model results against the ground truth (GT). Specifically, BMTABLEMODELS was employed to compare the annotated prediction results of each model for TD, TSR,and TCR tasks with their corresponding GT annotations (Table 2).

Table 2: TEAM-CC Metric Definitions   
![](images/86b891aa65784951914bf324b30fd6dc2a7e74db3758e6eff187950ffb0b1916.jpg)

This work applied benchmarking strategy analysis through an automated batch inference process (via BMTABLEMODELS） and not through training due to the need to graphically evaluate how the models behaved in recognizing the tables data structure more complex formats, in the case of calibration certificate tables, collecting possible gaps in the interpretation of these data.

The Table Detection Completeness Percentage (TDCP) metric quantifies the total number of tables detected by each model and calculates the percentage of completeness

relative to the GT. Specifically,a TDCP value closer to 10o% indicates higher accuracy in table detection, meaning the model's detections closely align with the GT. The GT dataset comprises a total of 1,130 tables extracted from 400 analyzed certificates.This comprehensive evaluation ensures that the models are thoroughly assessed for their ability to accurately detect tables in various document formats.

The low completeness percentage for some models, such as Tablenet and DETR, is justified because several analyzed certificates had many tables per page and were close to each other. In this situation, these models interpreted them as a single table. The YOLO model achieved the best results,identifying a greater number of tables with 67% completeness (Fig.1).

For TD task, this study evaluated the YOLO,DETR,and TATR models,noting that the Tablenet model does not provide table and cell coordinates.The Table Bbox Coordinates Similarities Percentage (TBCSP) metric measures the similarity between the detected table contour pixel coordinates and the GT for the TD task through the intersection over union.IoU measures the degree of overlap between the predicted and actual areas, providing a simple and effective score for localization performance. Using this metric, the YOLO model achieved the highest accuracy among the evaluated models, with a TBCSP of 87%.

![](images/e510c5776123a7bc52057b8bfa1e474bdb337dd1daef3b48df3c379ebad92126.jpg)  
Fig. 1: Benchmarking Results

For the TSR task, the Cell Bounding Box Coordinates Similarity Percentage (CBCSP） metric was employed,analogous to the TBCSP but focused on cell-level bounding-box coordinates.TATR achieved the highest accuracy in predicting cell coordinates (41%), followed by TableMaster (35%),UniTable (31%),and DETR (15%). The remaining models are unable to perform TSR tasks.

The Tree Edit-Distance-based Similarity (TEDS) metric [58] (Eq. 1） is employed to evaluate tabular structures by analyzing the structural differences between hierarchical representations such as HTML, XML,or JSON documents. TEDS quantifies

the discrepancies by defining a set of cost operations—removal, insertion， and edit-ing—required to transform a given tree or table A into a reference tree B (GT). The metric operates on the principle that the greater the structural difference between trees A and B, the higher the adaptation cost, resulting in a lower TEDS percentage value.

$$
\operatorname {T E D S} \left(T _ {a}, T _ {b}\right) = 1 - \frac {\operatorname {E d i t D i s t} \left(T _ {a} , T _ {b}\right)}{\max \left(\left| T _ {a} \right| , \left| T _ {b} \right|\right)} \tag {1}
$$

For the TEDS metric, only models capable of performing the TSR task can infer the corresponding HTML structure. Among these models, TATR achieved the highest score (71%). These results indicate that while TATR shows promise in structural and coordinate mapping,there remains room for improvement to reach higher levels of accuracy in table extraction tasks.

For the TCR task, the Cell Tokens Valid Data Percentage(CTVDP) metric is the percentage of valid data based on the total number of existing reference cells (GT). If the content of each bbox is 10o% similar to the corresponding content of the GT, it is considered valid data.The similarity calculation between two strings was based on the Levenshtein Distance mathematical model. The TATR model combined with EasyOCR yielded the highest data extraction accuracy (66%). Therefore, benchmark-ing experiments showed that YOLOvll achieved the best performance in the TD task, while TATR yielded the best results in the TSR and TCR tasks.

# 3.3 Identified Gaps in State-of-the-Art Models

During the evaluation and results collection phase,we identified that the models struggled with certain tabular structures and cell content complexities. Specifically structural challenges included:

· Double Borders: Tables with multiple bordering lines confused the models,making it diffcult to accurately delineate individual tables,with correct boundary delineation achieved in only 13% of the cases.   
· Spaced Headers: Headers with excessive spacing hindered the models’ability to correctly identify and align columns and rows (66%).   
· Nested Tables: Tables embedded within other tables posed significant chalenges for structure recognition (32%).   
· Watermarks (Fig. 2): The presence of watermarks interfered with the models' ability to accurately extract and interpret table content (36%).   
· Closely Spaced Tables: Tables positioned very close to each other were often misinterpreted as a single table, reducing detection accuracy (15%).   
· Special Characters: TCR models struggled to accurately capture special characters, including symbols like “Ω” and “oo”, present in the certificate tables (73%).

Regarding special characters, this gap adversely impacted the table structure by obscuring columns containing these characters and disrupting their original dimen-sions. As a result, the affected cels were often not recognized or were missing entirely, hindering the comparison of extracted table contents with the corresponding GT.This limitation highlights the need for improved character recognition capabilities to ensure comprehensive and accurate table extraction.

Medicoes em Tensäo Continua DC Voltaqe Measurements   
![](images/51be113b165161067279a2ae45ad0bd062cf01443eca20c6cfb156c4cd61a16d.jpg)

Fig. 2: Example of a table from a calibration certificate containing watermarks that hinder accurate table recognition.

V

Thus,this work proposes an architectural adaptation strategy combined with a carefully designed fine-tuning process applied to the models that achieved the best performance in the TD (YOLOvl1) and TSR (TATR) tasks. This approach addresses the identified benchmarking gaps and aims to optimize table detection and recognition, using a dataset of calibration certificates. 8

# 4 Tablecert's Methodology

# 4.1 Modules application strategy

The benchmarking results identified two models for the architecture adaptation and fine-tuning process: YOLOv11 for the TD task and TATR for the TSR task. YOLO's adaptation focused on benchmarking TD's gaps - watermarks, double borders,and closely spaced tables- while TATR focused on TSR gaps - spaced headers,nested tables,and watermarks (applied to both models).

To address these task-specific gaps, dedicated architectural modules were adapted and integrated into the baseline architectures of YOLO and TATR using Tablecert, a dynamic model-building framework for architectural adaptation. Table 3 summarizes the definition of each module, their intended functionality, the corresponding target task and gap. Module combinations (versions） per-model were developed according to the target task.In other words,modules specialized for table detection (TD） were incorporated into the YOLO combinations,while modules focused on table structure recognition(TSR）were employed in the TATR combinations.

# 4.1.1 Freqfilter2D

Watermarks often introduce high-frequency noise that degrades feature extraction in document images.To mitigate this issue,a frequency-domain filtering module (FreqFilter2D）was developed. This module enhances the spectral representation of document images by suppressing high-frequency noise, while preserving structural patterns relevant to table layouts. This is particularly important in legacy calibration certificates, where watermarks and visually reinforced borders introduce noise that interferes with

Table 3: Modules application strategy.   
![](images/3d749a28363f1f2c9070ca03eb1f55fab4a7358211f92901e787d1f3f7bcfdb1.jpg)

early convolutional feature extraction. By operating in the frequency domain, the module aims to improve robustness against watermark artifacts and double-border patterns that commonly degrade table detection performance. Due to its primary function of noise reduction, it can also be applied to table structure detection.

Formally, the module performs parameterized low-pass regularization in the frequency domain, transforming feature maps via a two-dimensional Fourier transform and selectively attenuating them according to a learnable filtering strength and cutoff ratio. This formulation enables a controlled trade-off between spatial detail preservation and noise suppression，allowing the network to retain salient structural information while reducing high-frequency artifacts. Further details of the architectural adaptation procedure are provided in Appendix A.

# 4.1.2 CBAM

Convolutional Block Attention Module (CBAM) applies sequential channel and spatial attention to emphasize informative features while suppressing irrelevant background regions.This mechanism is particularly effective for separating closely spaced tables, resolving nested layouts,and handling uneven header spacing, where salient structural cues may be visually subtle.

At an operational level, CBAM introduces an adaptive reweighting of feature responses by modeling inter-channel dependencies followed by spatial importance esti-mation (Appendix B). The channel attention stage selectively amplifies feature maps that encode discriminative structural patterns,while the subsequent spatial attention focuses the model on spatial regions that are most relevant for table delineation. This sequential attention strategy improves robustness in complex layouts by reducing the influence of background clutter and visually ambiguous regions.

# 4.1.3 BRM

Double-bordered and visually reinforced table edges frequently result in inaccurate bounding box predictions,as the presence of closely spaced parallel lines often leads to localization errors or complete detection failures. This behavior was consistently observed in the benchmarking results.Boundary Refinement Modules (BRM) were applied to refine fused representations with an explicit focus on spatial boundaries, reducing boundary drift and improving alignment with table contours.

By blending a learnable boundary-focused transformation with an identity mapping,the module enables controlled correction of localization errors without destabilizing upstream feature representations (Appendix C). This residual formulation is particularly efective in mitigating boundary ambiguity caused by double lines and reinforced edges, leading to more consistent alignment between predicted bounding boxes and true table contours.

To complement boundary refinement,an edge-aware detection head was integrated into models’ final detection stage. This head incorporates multi-scale edge features derived from intermediate representations, enhancing sensitivity to contour transitions and improving the detection of tables with thick or duplicated borders.

# 4.1.4 CoordConv

Closely spaced tables pose challenges for detectors due to ambiguous spatial separation and overlapping contextual cues. CoordConv enhances spatial awareness by explicitly encoding absolute positional information,this adaptation improves the model's ability to discriminate adjacent table instances and reduces false merges between nearby structures.

From a functional perspective, CoordConv augments convolutional feature maps with explicit, normalized spatial coordinate channels,enabling the network to access absolute positional cues that are otherwise implicitly inferred by standard convolution operations (Appendix D). This explicit coordinate encoding mitigates spatial ambi-guity in densely packed layouts and supports more consistent localization of adjacent table regions,particularly in scenarios where visual appearance alone is insufficient for reliable instance separation.

# 4.1.5 Lite Transformer

Convolutional backbones are limited in capturing long-range spatial dependencies, which are critical in complex table layouts spanning distant regions of the page. Although full Transformer architectures address this limitation at a high computational cost,the Lite Transformer module provides a lightweight alternative for injecting global contextual reasoning into convolutional feature hierarchies.

Operating as a residual refinement block, the Lite Transformer introduces effcient long-range interactions through a compact Transformer encoder applied to tokenized feature maps,while preserving the locality and efficiency of convolutional representations (Appendix E).

# 4.2 Architecture adaptation pipeline

After the module application strategy based on the identified benchmarking gaps, this work proposes an architectural adaptation pipeline,implemented within the Tablecert framework, to construct enhanced YOLO and TATR models (Fig.3). Despite the targeted, gap-driven module selection, their full inclusion within the model architectures may not yield optimal performance. Consequently, this work evaluated multiple application scenarios to enable a systematic comparison of results. This consideration motivated the development of several enhanced model versions for the build process.

# 4.2.1 Dataset

The first step consisted of dataset preparation. As previously described, the YOLObased models employed a pretrained version from PubTables-1M dataset,while the Table Transformer (TATR) model also relied on its original pretrained weights, which were likewise obtained from training on PubTables-1M.

Subsequently, a fully supervised annotation strategy was adopted using a calibration certificate table dataset comprising loo,ooo table instances, increased with a substantial number of samples issued by a government laboratory and from open datasets ([59, 22, 30]). Half of the new certificates dataset was generated through a sophisticated data synthesis pipeline.The certificates dataset was designed to be uniformly distributed across the identified structural gaps,ensuring balanced supervision. This new dataset cannot be disclosed due to data confidentiality agreements.

In this stage,a reference representation of the table structure was defined through ground truth(GT） annotations,stored in JSON fles，which served as supervisory signals for model adaptation and training. The annotation process followed the specific format requirements of each model architecture: the YOLO models used annotations in the YOLO format,whereas the TATR model adopted the COCO annotation format. All ground-truth (GT） data were generated through a semi-automatic annotation process using the LabelImg³(assession） and Img2Table4 (annotation) tools.

First step also included image pre-processing and data augmentation. This work applied an image processor with resizing and padding so that all images have a fixed size of 800x800 pixels.In this way, the inputs to the model were standardized, which is essential for proper functioning, especially when dealing with images of varying sizes. In addition, data augmentation transformations are applied during training. These transformations include perspective distortion, horizontal mirroring,brightness/con-trast adjustments,and hue/saturation/value changes to make the model more robust to visual variations.

# 4.2.2 Version Selection /Builder

To address the TD and TSR gaps identified during benchmarking, this work adopts a targeted architectural adaptation strategy built upon both models. Instead of proposing a monolithic redesign,architectural enhancements were selectively introduced at different stages of the network,each aligned with a specific gap observed.

![](images/7ac8974996c8cae32e0eae5af7f2639476ffb33864d15c8c03728d07bb54e7ef.jpg)  
Fig. 3: Tablecert's framework pipeline.

The second step was to define architecture versions with corresponding modules combinations and gaps targets (as described in Sect. 4.1). All adaptations were applied dynamically per model through a unifed builder (third step),enabling controlled experimentation across multiple architectural combinations while preserving the original training and inference pipeline.For each model, this work developed seven adapted architectural configurations in addition to a classical baseline without adaptation. Each configuration was evaluated both with and without the application of LoRA, resulting in a total of sixteen model versions per model.

Furthermore, to optimize the training and cross-validation procedures, two distinct categories of loss functions were employed in this work: architectural losses (Table 4) and builder-defined training losses. Architectural losses are intrinsically associated with specific modules or architectural adaptations and are designed to explicitly guide the learning process toward the targeted structural improvements, such as boundary

Table 4: Architectural Modules and Corresponding Lambdas and Ranges applied to Cross Validation   
![](images/5ed68d36eabb8cac6d633c2717cb177fa065f5e5bd9e70a063b623789d2d39f0.jpg)

refinement or edge awareness. These losses operate at the module level,are applied using weights randomly drawn from a predefined range, and act as auxiliary optimization signals that reinforce the intended behavior of the corresponding architectural components.

In contrast, the losses configured through the model builder govern the overall training objective and ensure compatibility between the adapted architecture and the baseline optimization framework.The builder dynamically activates or deactivates loss components based on the selected architectural configuration, enabling consistent training and fair comparisons across different model variants.

# 4.2.3 Model Enhanced

The builder generated model versions with or without LoRA wrappers (fourth step). LoRA wrappers were incorporated into the model construction process to enable efficient fine-tuning of newly introduced architectural modules,while preserving the pretrained representations of the baseline networks.By restricting parameter updates to low-rank adaptation matrices,the optimization focused on the added components, improving training stability and computational effciency. In addition,each version were trained without LoRA to assess the impact of full-parameter optimization and to provide a direct comparison between parameter-efficient and fully trainable adaptation strategies.

# 4.2.4 Training & Cross Validation

The fifth step comprises the training and evaluation of the constructed model variants under a controlled cross-validation and hyperparameter optimization protocol. The dataset is first partitioned using a fixed hold-out strategy, with 7O% of the samples assigned to training,15% to validation,and 15% reserved as an unseen test set.

Cross-validation is applied only within the training split,using a 5-fold K-fold procedure (five folds per trial) with shuffled indices and a fixed random seed.A total of 20 trials are conducted, each corresponding to a distinct hyperparameter configuration evaluated across the five folds.For each fold,the training subset is used to optimize model parameters,while the corresponding validation subset is employed for early stopping and performance monitoring. All models are trained for a maximum of 500 epochs,using an early stopping criterion with a patience of 1O epochs based on validation loss, which substantially reduces unnecessary computation while preventing overfitting.

Hyperparameter optimization is conducted using Optuna within this crossvalidation framework.In this context，a trial corresponds to a single sampled configuration,defined by (i) the selected pretrained checkpoint,(ii) the architectural control parameters (A-coefficients associated with the proposed modules),and (iii) the loss-balancing coefficients for classification and localization terms. Each trial is evaluated by averaging the validation loss across the five folds,yielding a robust estimate of its expected performance.

For each architectural variant,at least one trial is conducted to explore the associated hyperparameter space.Model selection is performed by identifying the configuration that minimizes the mean cross-validation loss. The top-performing configuration per model variant is subsequently retained for comparative analysis,and the final evaluation is conducted once on a fixed test set using the selected model.

This protocol ensures a clear separation between hyperparameter optimization and final testing, improving reproducibility and enabling straightforward auditing of the experimental results.

# 4.2.5 Evaluation Protocol

At the final evaluation step, this work assessed the YOLO and TATR architectural variants from two complementary perspectives: (i) model quality, quantified using standard deep-learning training and detection metrics; and (i) prediction quality on the table-related gaps identified during benchmarking，quantified using the TEAM-CC metrics cOmputed with the BMTABLEMODELS tool.

# (i) Model quality.

Model quality was evaluated using COCO-style object-detection metrics provided by the official evaluation libraries associated with each framework.The main reported metrics include evaluation loss,mean average precision (mAP),mean average recall (mAR),F1-score,Precision,and Recall. For YOLO,evaluation was performed for a single class (table). For TATR,evaluation considered six structural classes: table, table row, table column, table column header, table projected row header,

and table spanning cell. In both cases,mAP/mAR were computed over IoU thresholds and reported for the same selected checkpoint.

All metrics reported in this work correspond to the best checkpoint selected within each fold, defined as the checkpoint that minimizes the validation loss under the early-stopping scheme. Final values are obtained by aggregating results across the five folds (and across trials when applicable),ensuring consistent checkpoint selection criteria for both model families.

# TATR evaluation details.

For TATR, overall mAP and mAR were computed following the Transformers evalu-ation protocol, with mAP@50 and mAP@75 evaluated at IoU thresholds of 0.50 and 0.75,respectively, and mAR@1oo (mean average recall considering up to 10o detections per image) [5, 41]. When supported by the evaluator, size-specific metrics (small, medium, large） were also reported; unavailable categories were represented as -1.0. In addition to global metrics,class-wise mAP and mAR were extracted for each of the six table-related structural classes to provide a fine-grained analysis of localization and classification performance.

# YOLO evaluation details.

For the YOLO-based models,detection metrics were extracted following the COCO evaluation protocol adopted by YOLO pipelines, including mAP@50,mAP@50-95 (IoU thresholds from O.50 to 0.95） [24]，Precision，and Recall. Using the same checkpoint-selection rule adopted for TATR (minimum validation loss), the reported YOLO metrics are aligned with the best-performing checkpoint per fold,enabling a consistent comparison of detection and spatial localization performance across YOLO and TATR-based approaches.

# Robustness across folds.

To quantify robustness to data splits, this work computed the standard deviation of the F1-score across the five cross-validation folds.Let K = 5,and let F1k be the F1-score obtained in fold k; then

$$
\sigma_ {F 1} = \sqrt {\frac {1}{K - 1} \sum_ {k = 1} ^ {K} \left(F 1 _ {k} - \overline {{F 1}}\right) ^ {2}}, \tag {2}
$$

where F1 is the mean F1-score across folds.

# Bounding-box matching for Precision/Recall/F1.

Precision,Recall, and F1-score were computed from bounding-box matches between predictions and ground truth (GT） using an IoU threshold T consistent with the mAP/mAR setting. Let TTP,TFP,and TFN denote the total numbers of true posi-tives,false positives,and false negatives,respectively. A GT instance is counted as a true positive if there exists at least one predicted box with IoU ≥ T; otherwise, it is a false negative. Conversely,a predicted box is counted as a false positive if it does

not match any GT instance with IoU ≥ T. This matching ensures that each bounding box contributes only once to TP,FP,or FN,even when multiple overlaps exist. The metrics are computed as

$$
\mathrm {P r e c i s i o n} = \frac {\mathrm {T T P}}{\mathrm {T T P} + \mathrm {T F P}}, \quad \mathrm {R e c a l l} = \frac {\mathrm {T T P}}{\mathrm {T T P} + \mathrm {T F N}}, \quad F _ {1} = 2 \cdot \frac {\mathrm {P r e c i s i o n} \cdot \mathrm {R e c a l l}}{\mathrm {P r e c i s i o n} + \mathrm {R e c a l l}}. \tag {3}
$$

# (ii) Prediction quality on benchmarking gaps (TEAM-CC).

To assess how well each model variant addressed the structural gaps identified during benchmarking, this work evaluated the best-performing versions using the TEAM-CC metrics via the BMTABLEMODELS software. This second evaluation perspective comple-ments standard detection metrics by explicitly measuring performance on challenging table characteristics (e.g.，watermarks,double borders, closely spaced tables, nested layouts,and spaced headers） previously observed during benchmarking.

# 5 Tablecert's Implementation

# 5.1 YOLO's architecture adaptation process

The YOLO model, which is based on a convolutional neural network, excels at detecting and classifying various types of images, effectively identifying table edges in this context.The YOLOvl1 standard architecture comprises three primary components: (i) Backbone,responsible for feature extraction from input images; (ii) Neck,a multi-scale feature fusion module that aggregates and processes features from the backbone to prepare them for detection;and (ii) Head,which handles the final detection and classification tasks based on the processed features (Fig. 4- left side).

The FreqFilter2D module is inserted as a pre-backbone operation,acting directly on the input feature stream before the first convolutional block.Unlike conventional spatial-domain filtering approaches,this module explicitly operates in the frequency domain, enabling the selective attenuation of high-frequency noise patterns while preserving mid-frequency structural components that are characteristic of table layouts.

This design choice is particularly effective in mitigating the impact of watermarks, background textures,and scanning artifacts, which often manifest as high-frequency disturbances that interfere with early feature extraction.By stabilizing the spectral content of the input,the FreqFilter2D module facilitates the learning of cleaner, more robust structural primitives,thereby improving the model's sensitivity to grid-like patterns and line continuity.

BRM is integrated at multiple stages of the neck, following feature concatenation operations across diferent scales. In contrast to traditional boundary-aware modules that operate only at the detection head,BRM is strategically positioned within the feature aggregation hierarchy, enabling boundary refinement before the final prediction.

This multi-stage insertion enables the model to iteratively refine spatial transitions and edge consistency across resolutions,which is essential for handling double borders

![](images/598d5b9971effccecbbbdb5e4e1c88720c4362019c0bbe1b1b83100a8f639eba.jpg)  
Fig. 4: YOLOvl1 original architecture versus YOLOvll enhanced architecture (all modules included)

and closely adjacent tables—two failure cases commonly observed in standard YOLObased detectors. By explicitly modeling boundary sharpness and continuity, BRM reduces boundary ambiguity and suppresses false merges between neighboring table instances.

CBAM is incorporated into the enhanced blocks deployed at selected backbone and neck layers. Unlike its canonical usage in image classification, CBAM is here adapted to emphasize structural feature channels that are more informative for table detection, such as line intersections, repetitive grid patterns,and aligned edges.

The channel attention mechanism selectively amplifies discriminative responses while suppressing irrelevant background activations,which is particularly beneficial in scenarios involving visual clutter and text-heavy regions. This selective emphasis improves the separability of table features from surrounding content，especially in dense document layouts.

To enable the integration of architectural modifications and Low-Rank Adaptation (LoRA) within the Ultralytics YOLO framework, targeted structural adjustments were introduced to preserve compatibility with the native training and inference pipeline. The Ultralytics implementation tightly couples the detection architecture with internal optimization routines,which limits the direct use of model-wrapping strategies commonly adopted in parameter-efficient fine-tuning libraries.

In this work, LoRA adapters were incorporated through direct, in-place parameter injection into selected convolutional layers, rather than by encapsulating the entire detection model within an external wrapper. This design preserves the original DetectionModel structure and ensures compatibility with core Ultralytics functionalities, including automatic mixed precision, model initialization,and distributed training. Consequently, the adapted model does not expose a PeftModel interface,although LoRA-specific parameters are correctly instantiated and optimized during training.

To guarantee the stability of the adapted architecture,automatic layer fusion and mechanisms that could trigger model reconstruction were explicitly disabled. For LoRA-applied versions,only the LoRA parameters were trainable,while all remaining network weights were frozen， substantially reducing the number of optimized parameters and promoting stable convergence.

Overall, these adaptations enable controlled experimentation with both architectural extensions and parameter-efficient fine-tuning within the Ultralytics YOLO framework, while maintaining training stability,reproducibility, and full compatibility with the original pipeline.

# 5.2 YOLOv11's loss function adaptation

$$
\mathcal {L} _ {\text {t o t a l}} = \lambda_ {\text {b o x}} \cdot \mathcal {L} _ {\text {b o x}} + \lambda_ {\text {o b j}} \cdot \mathcal {L} _ {\text {o b j}} + \lambda_ {\text {c l s}} \cdot \mathcal {L} _ {\text {c l s}} + \mathcal {L} _ {\text {a r c h}} ^ {(v)} \tag {4}
$$

$$
\mathcal {L} _ {\text {b o x}} = \mathcal {L} _ {\mathrm {d f l}} + \mathcal {L} _ {\mathrm {I o U}} \tag {5}
$$

YOLO loss function (Eq. 4) contains three loss variables and the architecture loss: Lbox (bbox localization loss,using IoU metric),Lobj (object detection loss),and Lcls (classification loss). Each loss variable is multiplied by its corresponding weight or lambda (入) for manipulation. Lambdas are weights assigned to each component of the loss and control the relative importance of each type of error during training.

Lbox contains distribution focal loss Ldn (Eq. 5) which is used to refine the bbox regression more accurately, especially in the YOLOvll model, which represents the edges of the boxes as discrete distributions instead of direct continuous values. The YOLO library only allows the manipulation of Xbox, Xdft and Xcls, but the work did not use the Xcls,due to the use of only one class (table). The work applied 2O trials with 5 folds for each checkpoint and considered a weighted average with a weight of 5 for Xbox and a weight of 1 for Xdfl.

for structural adaptations specific to each YOLO version. This term is applied per version during training, capturing the contribution of modules such as FreqFilter2D, BRM,and CBAM in handling gaps and other structural challenges. By incorporating Caloiad explicitly guides the model to optimize both detection accuracy and architectural adaptations, while preserving the original forward pass and loss computation workflow.

# 5.3 TATR's architecture adaptation process

TATR is built on a self-attention transformer network, specifically designed to detect complex features within table structures. These features include columns,rows, headers,and attributes like rowspan and colspan,among others.This specialization makes TATR well-suited for handling the nuanced aspects of table recognition that YOLO cannot adequately address.

TATR is a model based on the DETR architecture，comprising three main components: a CNN backbone to extract a compact feature representation,an encoderdecoder transformer,and a simple feed-forward network (FFN) for the final detection

prediction (Fig.5). The model generates N predictions on a single image. For each prediction,basically, two pieces of information come into play: the class and the corresponding bbox coordinates.Regarding table categories,TATR currently handles six classes: table,table column, table row, table column header, table projected row header,and table spanning cell.

The FreqFilter2D module was integrated at the backbone stage, prior to the Coord-Conv and convolutional feature extraction layers based on ResNet-50. Specifically, this module operates on the input or early feature maps before they are further processed by the ResNet-5O layers and forwarded to the neck for feature fusion.

At this stage, FreqFilter2D applies a frequency-domain filtering operation to the spatial feature maps, selectively attenuating high-frequency noise while preserving dominant low- and mid-frequency components. This placement allows the module to act as an early structural regularizer,stabilizing the feature representation prior to subsequent attention-based processing. By filtering backbone outputs,the module ensures that downstream transformer layers receive feature maps with enhanced global structural coherence.

![](images/f20b3ced828983eeb0e6801eb3a3b7a0fe417e0d5519c99f406ab44201e5e62f.jpg)  
Fig. 5: TATR original architecture versus TATR enhanced architecture (al modules included).

The CoordConv module was incorporated within the backbone, immediately after the FreqFilter2D preprocessing. CoordConv augments the input feature maps with explicit normalized spatial coordinate channels (e.g., horizontal and vertical positional maps）before the convolutional layers of ResNet50.This provides the network with explicit positional information early in the feature extraction process.By introducing direct spatial context, this approach reduces positional ambiguity and enhances the geometric awareness of the learned representations before they are processed by the attention mechanisms.

CBAM is employed as an intermediate feature-refinement mechanism, applied to convolutional feature maps to enhance structurally relevant responses. The channel and spatial attention branches implement inter-channel dependencies and spatial saliency, respectively.

The Lite Transformer is integrated as a lightweight contextual pre-processor at the onset of the feature fusion neck.Positioned to initiate long-range dependency modeling,it captures structural relationships between table elements—such as row-column alignments and header-cell associations-prior to the main attention mechanisms. By establishing preliminary contextual awareness, this efficient module alleviates the computational demand on subsequent transformer layers while enhancing geometric coherence in the fused representations.

The BRM is incorporated within the feature fusion neck,positioned after layer normalization and before the final feed-forward network (FFN) of the prediction head.At this stage, the BRM operates on multi-scale feature representations fused by the attention mechanisms, enhancing boundary-sensitive information prior to their propagation to the detection layers.By refining spatial transitions in the fused representations, the module emphasizes edge-aligned features,enabling more precise localization of table structures.

LoRA-applied versions were integrated into the TATR using the official PEFT framework,ensuring full compatibility with the Hugging Face Transformers and Trainer library. The model was first extended through a modular architecture builder, after which LoRA was applied as an independent adaptation step without altering the original training or evaluation pipeline.

LoRA was configured using the LoraConfig class from the PEFT library and selectively injected into predefined attention and convolutional modules,explicitly specified according to the architectural version. Following PEFT's native mechanism, no changes were required to loss computation,optimization, checkpointing,or metric evaluation. Standard COCO-style detection metrics were computed using the same evaluation protocol as non-LoRA models, ensuring methodological consistency across experiments.

# 5.4 TATR's loss function adaptation

$$
\mathcal {L} _ {\text {t o t a l}} = \lambda_ {\mathrm {c l s}} \cdot \mathcal {L} _ {\mathrm {c l s}} + \lambda_ {\mathrm {L 1}} \cdot \mathcal {L} _ {\mathrm {L 1}} + \lambda_ {\mathrm {G I o U}} \cdot \mathcal {L} _ {\mathrm {G I o U}} + \mathcal {L} _ {\text {a r c h}} ^ {(v)} \tag {6}
$$

In the case of the TATR model, the error detection function (Eq.6) contains three loss variables: Lcls (classification)，LLi (bbox coordinates),and LGIoU (generalized IoU),each one multiplied by the corresponding ”X". The TATR library allows to manipulate Xcls and XL1. The cross-validation and grid search process was carried out with 20 attempts and 5 folds per checkpoint, considering 入L1 (weight 5) and Xcls (weight 1). The same architecture-aware design applied to YOLO,including dynamic module integration and per-version computation of C(rch Carch, was also implemented in the Table Transformer (TATR),enabling the model to adapt its structural components and optimize architecture-specific losses in a comparable manner.

In both models, the work performed tests to evaluate the initial hypothesis that applying LoRA fine-tuning at the middle and final layers of those structures would be more efficient than the initial layers.

# 6 Results

# 6.1 Models’ Quality Results

Table 5 reports the performance of the evaluated YOLO architecture versions with and without Low-Rank Adaptation (LoRA). Among all configurations, version 5 without LoRA(YOLO-V5) achieved the highest F1-score (0.9996). Although YOLO-V3 with LoRA obtained the lowest evaluation loss (0.3322), its lower F1-score compared to YOLO-V5 demonstrates that reduced optimization loss does not necessarily translate into improved structural recognition performance.

Consequently, this work adopts the F1-score as the primary criterion for model selection,as it directly reflects the balance between precision and recall and provides a more reliable assessment of model effectiveness during table structure recognition at inference time.

In addition to average performance,we also report the standard deviation (STD) across folds to assess model stability (Appendix F). The YOLO-V5 configuration maintains high accuracy with relatively low inter-fold variability (F1-score: O.9996 ± 0.0279), indicating robust and consistent performance across folds. Although YOLO-V5 achieves the highest average performance,other configurations, such as V2 without LoRA，exhibit slightly lower F1-scores but substantially reduced variability (lower STD), indicating more stable behavior across folds (F1-score: O.9955 ± 0.0194).

Table 5: Performance comparison of YOLO architecture versions.   
![](images/f58748fa2b3a8c171bf10f90e8fb45562fc868c0ac2b05d8fbf994ecd3f7dd70.jpg)

The results indicate that LoRA improved F1-score performance in 4 of 8 architectural adaptations. This suggests that LoRA's effectiveness is strongly dependent on its alignment with the underlying architectural design,rather than being universally beneficial.

Architectural modifications based on spatial-frequency filtering and edge-aware feature refinement,particularly the use of FreqFilter2D and the Border Refinement Module (BRM)，consistently demonstrated better compatibility with the YOLO detection framework. These components enhance sensitivity to structural patterns and object boundaries,which are critical for accurate localization in convolutional detection pipelines. The combination of frequency-domain enhancement and boundary refinement in YOLO-V5 improved convergence and yielded superior detection accuracy.

In addition to achieving the highest F1-score,YOLO-V5 maintained high precision and recall simultaneously, indicating balanced detection performance. Other variants reached competitive mAP@50 values but exhibited higher evaluation loss or greater variability, limiting their robustness.A detailed comparison of mAP@50 and mAP@5O-95 across all versions is provided in Appendix F, further confirming the superior performance of V5.

Regarding the TATR results (Table 6), version 6 with LoRA (TATR-V6) achieved the highest F1-score,with an average value of 0.9640 ± 0.0656 across all six detected classes (complete results in Appendix G). In addition to its superior mean performance, TATR-V6 exhibits low inter-fold variability, indicating stable and robust behavior under cross-validation.Moreover,although TATR-V2 with LoRA achieved the lowest evaluation loss (0.1452), it was not considered the best-performing model due to its lower F1-score compared to TATR-V6, as previously discussed. The TATR-V6 model achieved the highest overall mAP value (0.8459); however, similar to the YOLO-based models,its mAP@50 and mAR@100 scores were competitive but did not represent the best results among the evaluated versions.

The results suggest that the superior performance of TATR-V6 is associated with the combined integration of the FreqFilter2D and Lite Transformer modules into the backbone.The FreqFilter2D module is applied at the earliest convolutional stage, directly on the RGB input projection,emphasizing low-frequency components while attenuating high-frequency noise. Similar to its effect on the YOLO model,this frequency-domain regularization improves the stability and consistency of early feature representations, particularly for recognizing table structures and edge-related features.

In parallel, the Lite Transformer module introduces lightweight self-attention mech-anisms into selected backbone layers, enabling more efective modeling of long-range dependencies across rows, columns,and spanning cels without significantly increasing computational complexity. By operating on the output of convolutional layers and preserving the original channel dimensions, the Lite Transformer enhances global contextual reasoning while maintaining compatibility with LoRA-based fine-tuning.

The synergy between frequency-aware feature filtering and context-aware attention refinement enables TATR-V6 to achieve a more balanced trade-off between preci-sion and recall, ultimately resulting in superior structural recognition performance, as refected in its highest average F1 score.Moreover,LoRA improved the F1-score

Table 6: Performance comparison of TATR architecture versions.   
![](images/0e8e8807e2fafcb1e0f0385abb944a6bbc2fda528979ec2dfc7d6c13bff3be85.jpg)

in 6 out of 8 architectural adaptations,including the best-performing TATR-V6 configuration.

It is important to note that the observed improvements in both models are consistent with the hypothesis that the FreqFilter2D module positively impacts performance, suggesting that frequency-domain normalization may contribute to performance gains during both the architectural enhancement and fine-tuning stages.By selectively attenuating high-frequency noise and reinforcing low-frequency structural cues at the earliest convolutional layers, FreqFilter2D promotes more stable and coherent feature representations. This behavior enhances the models' robustness to local perturbations, improves generalization across diverse document layouts,and preserves global structural priors essential for accurate table and object boundary recognition in both TATR and YOLO architectures.

Finally, for both TATR and YOLO, the variants combining all adapted modules into a single architecture failed to achieve significant performance gains and consequently did not rank among the seven best adaptations.

# 6.2 Model's Prediction Results

While Section 6.1 selects the best-performing variants based on COCO-style metrics (with F1-score as the primary criterion),this section focuses on robustness under

benchmarking gaps quantified by TEAM-CC. Therefore, for the gap-oriented analysis,we report the variants that maximize TEAM-CC performance,which may differ from the variants that maximize F1-score under standard detection metrics.In particular, TATR-V6 achieves the highest F1-score,whereas TATR-V2 yields the strongest improvements under gap-specifc conditions (e.g., double borders and closely spaced tables).For YOLO,YOLO-V5 is consistently selected under both criteria.

BMTABLEMODELS software is employed to apply TEAM-CC metrics and compare the performance of the original YOLO and TATR benchmark models with their adapted counterparts. Specifically, two representative variants were selected per model: (i) a classical baseline without architectural modifications and without LoRA adaptation (YOLO-VO and TATR-VO)，and (ii） an enhanced configuration selected based on the best F1-score performance,incorporating architectural adaptations and LoRA (YOLO-V5 and TATR-V6). We applied TEAM-CC to a fixed test set not used in training/validation.

From the perspective of the TEAM-CC metric (Fig. 6a), YOLO-V5 demonstrated a consistent improvement over both the benchmarking and classic configurations, achieving a 7% gain in table-per-page detection (TDCP) and a 5% increase in table boundary coordinate precision （TBCSP） compared to the benchmarking version. These results indicate that the proposed architectural adaptations effectively enhance table localization robustness without compromising detection stability.

In contrast, TATR-V6 exhibited stronger gains in detection-centric metrics,yield-ing a 10% improvement in TDCP, and a moderate 2% increase in TBCSP, suggesting a more conservative impact on boundary refinement.However，when considering structure-sensitive evaluation, TATR-V6 achieved substantial improvements in celllevel accuracy, with approximately 9% gains in both cell boundary coordinate precision (CBCSP） and TEDS compared to the TATR benchmarking version. These improvements translated into a marked enhancement in content detection validity (CTVDP), refecting more reliable structural recognition within correctly localized table regions.

Regarding the gap-oriented evaluation (Fig 6b), YOLO-V5 exhibited a pronounced improvement in handling tables with double borders,achieving a detection rate of 67%,whereas TATR-V6 did not show measurable gains in this specific scenario. This outcome suggests that boundary-sensitive adaptations are more effective within the YOLO-based detection pipeline for this class of structural ambiguity.

For table and structure recognition in the presence of watermarks, both models demonstrated substantial improvements, with YOLO-V5 reaching 68% and TATR-V6 achieving 87%, indicating enhanced robustness to background interference and visual noise.

In the scenario involving closely spaced tables,YOLO-V5 successfully identified 81% of cases. Conversely, TATR-V6 showed superior performance in more structureintensive scenarios,achieving 82% accuracy for nested tables and 91% for spaced headers,highlighting its stronger ability to capture complex hierarchical and layoutdependent table structures.

![](images/0be139ee0e28a92d002585ac499beef70995c133d7dbc90da19b7de09ed23d7f.jpg)  
(a) TEAM-CC

![](images/bdae96d282a42af305adb5d3682942928d71c24c718bc5bf95fc863fcdceb523.jpg)  
(b) Gaps   
Fig. 6: Models Predictions Results.

# 6.3 Prediction Examples

This work utilized samples of certificate tables images that were not used in the training and validation processes as test input for the models. In the YOLO-V5 prediction example for table detection (Fig.7a), the table sample used has two notable characteristics: watermarks and closely spaced tables.

The standard YOLO model, trained using classic fine-tuning, incorrectly interpreted the scene as containing three tables,with two detections erroneously merged into a single table instance.In contrast,YOLO-V5 correctly identified two distinct tables: the primary table on the left with 97% IoU effciency,and a secondary adjacent table on the right.

Regarding the detection of table elements (headers, rows, columns, etc.), the TATR model represents cell separations in a centralized fashion rather than aligning them

![](images/0bc0330afbb6617fbd167001316e5a3f3f2006717a9ad22ae0d70e5f320c22c1.jpg)  
(a) YOLO prediction comparison

![](images/22f5bd696b5424b29ab7f27154f666f61f8e73a80d8cd32fafbd4165498e60cf.jpg)  
(b） TATR prediction comparison  
Fig. 7: YOLO and TATR prediction examples.

strictly with cell boundaries (Fig. 7b - lower table ). This design choice allows the model to more accurately capture and associate the textual content contained within each table cell. With TATR classic fine-tuning,variations in the alignment of element detections are observed compared to the original table boundaries，with an average efficiency of 72%,based on the average IoU per detected element.In contrast, the TATR-V6 demonstrates a visually more refined overlap,with the predicted rows exhibiting greater faithfulness to the original table boundaries,achieving an efficiency of 88%.

# 7 Conclusion

This work is based on Tablecert,a modular architectural adaptation of the TATR and YOLO models through an intelligent plug-and-play builder strategy, in which compatible modules are systematically integrated to address latent limitations identified in a benchmarking scenario for table detection and recognition on a dataset of calibration certifcates.This modular design enables the controlled integration and isolation of architectural components,allowing a fair, reproducible,and fine-grained evaluation of their individual and combined contributions.

Based on the results, the adapted YOLO-V5 and TATR-V6 models emerged as the most effective configurations for addressing benchmarking gaps in table detection and recognition. This conclusion is supported, first,by their superior performance in

terms of F1-score combined with consistently lower evaluation loss,and second,by their enhanced capability to mitigate structural and detection gaps observed durig a new benchmarking round. Furthermore, prediction examples on unseen table samples allowed qualitative and quantitative analyses,suggesting that the models exhibited the expected improvements in addressing the identified gaps.

For YOLO-V5, the results indicate that integrating the FreqFilter2D and BRM modules yields the most effective configuration. This combination significantly improved robustness to certified noise and boundary localization, enabling accurate delineation of table limits, particularly in challenging scenarios involving nearby tables and watermark interference.

Similarly, TATR-V6,augmented with FreqFilter2D and LiteTransformer modules, demonstrated improved normalization of high-frequency noise and an enhanced ability to model complex structural relationships. These adaptations enabled the model to more accurately capture gap correlations in nested tables and sparsely spaced headers, thereby improving structural recognition performance.

Since the best-performing configurations of both models included the FreqFilter2D module, the results suggest that this component represents a promising architectural adaptation introduced in this work,which may be further tested and evaluated in other computer vision models, indicating potential directions for future research in addressing additional detection tasks.

For the TATR model, the variants adapted with the CBAM and CoordConv modules did not achieve the expected performance gains,ranking among the weakest performers within the top seven configurations. In contrast, for YOLO,the CBAM-adapted variants yielded superior results,appearing among the top two configurations in terms of F1-score.

Despite these advances,the architectural adaptations still exhibit limitations, especially in the precise definition of cell coordinates (CBCSP) and in structural similarity measured by TEDS.Additional challenges remain in scenarios involving double borders,closely spaced tables,and deeply nested table structures. These findings suggest that,while the proposed adaptations improve overall robustness, further refinements are required to enhance fine-grained structural accuracy.

Future work will focus on exploring new architectural adjustments and refinement strategies within the proposed modular framework for both models,aiming to further strengthen gap handling and generalization, including TCR tasks analysis. Additionally, expanding and diversifying datasets from multiple sources to explicitly capture recurring gap patterns is expected to improve robustness and scalability across heterogeneous document collections.

# A FredFilter2D - Frequency Filtering

Let X ∈ RBxCxHxW denote an input feature tensor. The FredFilter2D operator applies frequency-domain regularization through a parameterized low-pass filtering mechanism:

$$
X _ {\text {f i l t e r e d}} = \Re \left\{\mathcal {F} ^ {- 1} \left(\mathcal {F} (X) \odot \left[ \left(1 - \lambda_ {\text {f i l t e r}}\right) + \lambda_ {\text {f i l t e r}} \cdot M \left(r _ {\text {c u t o f f}}\right) \right]\right) \right\}, \tag {A.1}
$$

where F(.)and F-1(·) denote the two-dimensional Fast Fourier Transform and its inverse, respectively,and O represents element-wise multiplication.

$$
M \left(r _ {\text {c u t o f f}}\right) = \mathbf {1} _ {\{| u - H / 2 | \leq H r _ {\text {c u t o f f}} / 2 \}} \cdot \mathbf {1} _ {\{| v - W / 2 | \leq W r _ {\text {c u t o f f}} / 2 \}}, \tag {A.2}
$$

where rcutoff ∈ (0,1) controls the spatial frequency bandwidth,Afilter ∈ [0,1] defines the filtering strength,and R{·} extracts the real-valued component of the inverse transform.

# B CBAM Attention Module

Let X ∈ RBxCxHxW denote an intermediate feature tensor extracted from either a convolutional_backbone_ (YOLO) or a convolutional encoder stage preceding the Transformer encoder (TATR). The Convolutional Block Attention Module (CBAM) enhances feature representations by sequentially applying channel and spatial attention mechanisms.

The channel attention operation is defined as:

$$
X _ {\mathrm {C A}} = X \odot \left[ \left(1 - \lambda_ {\mathrm {C A}}\right) + \lambda_ {\mathrm {C A}} \cdot \sigma (\operatorname {M L P} (\operatorname {A v g P o o l} (X)) + \operatorname {M L P} (\operatorname {M a x P o o l} (X))) \right], \tag {A.3}
$$

where g(·) denotes the sigmoid activation function.The spatial attention mechanism is subsequently applied as:

$$
X _ {\mathrm {C B A M}} = X _ {\mathrm {C A}} \odot \left[ \left(1 - \lambda_ {\mathrm {S A}}\right) + \lambda_ {\mathrm {S A}} \cdot \sigma \left(\operatorname {C o n v} _ {7 \times 7} \left(\left[ \operatorname {A v g P o o l} _ {c} \left(X _ {\mathrm {C A}}\right), \operatorname {M a x P o o l} _ {c} \left(X _ {\mathrm {C A}}\right) \right]\right)\right) \right], \tag {A.4}
$$

where O denotes element-wise multiplication. The parameters XcA ∈_[0,1]_and XsA ∈ [0,1] control the contribution of channel and spatial attention,respectively.When XcA = SA = 0, the module reduces to an identity mapping, whereas XCA = λsA =1 corresponds to the standard CBAM formulation.

This formulation is architecture-agnostic and is employed identically in both YOLO and TATR models,difering only in the insertion point within each architecture.

# C Boundary Refinement Module (BRM)

Let X ∈ RBxCxHxW denote an intermediate feature representation extracted from either the neck stages of YOLO or the decoder output features of the Table Transformer (TATR). The Boundary Refinement Module (BRM) enhances boundary-sensitive features through a lightweight residual refinement mechanism.

The refined feature tensor is computed as:

$$
X _ {\mathrm {B R M}} = \sigma \left(\lambda_ {\mathrm {B R M}} \cdot \mathcal {G} (X) + \left(1 - \lambda_ {\mathrm {B R M}}\right) \cdot X\right), \tag {A.5}
$$

where g(·） denotes the ReLU activation function and 9(-） represents a learnablerefinement operator defined as:

$$
\mathcal {G} (X) = \operatorname {B N} \left(\operatorname {C o n v} _ {1 \times 1} \left(\sigma (\operatorname {B N} (\operatorname {C o n v} _ {1 \times 1} (X)))\right)\right). \tag {A.6}
$$

The parameter 入BRM E [0,1] controls the contribution of the refined features relative to the identity mapping.When λBRM = 0,the module reduces to an identity function, whereas XBRM =1 corresponds to full boundary refinement.

This formulation is architecture-agnostic and is applied identically in both YOLO and TATR models,differing only in the integration point, namely the neck feature aggregation stages in YOLO and the decoder feature outputs in TATR.

# D Coordinate Convolution Positioning (CoordConv)

Let X∈RBxCxHxWdenote an input image or intermediate feature map extracted from either the YOLO backbone-neck transition or the initial convolutional stage of the Table Transformer (TATR). The CoordConv module augments the input representation by explicitly encoding normalized spatial coordinate information.

Two normalized coordinate maps are first generated:

$$
X _ {x} (i, j) = \frac {2 j}{W - 1} - 1, \quad X _ {y} (i, j) = \frac {2 i}{H - 1} - 1, \tag {A.1}
$$

where_i ∈ [0,H-1] and j ∈ [0,W -1] denote the spatial indices. Optionally,a radial distance channel is included as:

$$
X _ {r} (i, j) = \sqrt {X _ {x} (i , j) ^ {2} + X _ {y} (i , j) ^ {2}}. \tag {A.2}
$$

The coordinate tensor is weighted by a scalar coefficient Xcoord ∈ [0,1] and concatenated with the original features:

$$
\tilde {X} = \left[ X \parallel \lambda_ {\text {c o o r d}} \cdot \left(X _ {x}, X _ {y}, X _ {r}\right) \right], \tag {A.3}
$$

where | denotes channel-wise concatenation and the radial component Xr is included only when explicitly enabled. When Xcoord = 0,the operation reduces to a standard convolutional input,whereas Xcoord = 1 corresponds to full coordinate encoding.

The augmented representation is then processed by a standard convolutional operator:

$$
Y = \operatorname {C o n v} _ {k \times k} (\tilde {X}). \tag {A.4}
$$

This formulation is architecture-agnostic and is applied identically in both YOLO and TATR models.In YOLO, CoordConv is inserted at the backbone-neck interface to enhance geometric localization prior to multi-scale feature aggregation. In TATR,the same mechanism is applied to the initial convolutional encoder layer, providing the transformer with explicit spatial awareness from the earliest stages.

# E Lightweight Transformer Module (Lite Transformer)

Let X ∈ RBxCxHxW denote an intermediate feature map produced byaconvolutional layer of either the YOLO architecture or the Table Transformer (TATR).The Lite Transformer module is designed to introduce long-range contextual modeling with minimal computational overhead,operating as a residual refinement block.

The input feature map is first projected into a latent space using a pointwise convolution:

$$
X _ {p} = \operatorname {C o n v} _ {1 \times 1} (X), \tag {A.5}
$$

where Xp ∈ RB×CxH×W.The spatial dimensions are then flattened into a sequence of tokens:

$$
S = \operatorname {r e s h a p e} \left(X _ {p}\right) \in \mathbb {R} ^ {B \times (H \cdot W) \times C}. \tag {A.6}
$$

The token sequence is normalized and processed by a lightweight Transformer encoder:

$$
\hat {S} = \mathcal {T} (\operatorname {L N} (S)), \tag {A.7}
$$

The encoded sequence is reshaped back to the spatial domain and combined with the projected features through a residual connection:

$$
\hat {X} = \operatorname {r e s h a p e} ^ {- 1} (\hat {S}) + X _ {p}, \tag {A.8}
$$

followed by a final pointwise convolution:

$$
X _ {\text {l i t e}} = \operatorname {C o n v} _ {1 \times 1} (\hat {X}). \tag {A.9}
$$

The Lite Transformer output is integrated with the original features using a scalar control parameter Xlite ∈ [0,1]:

$$
Y = X + \lambda_ {\text {l i t e}} \cdot X _ {\text {l i t e}}. \tag {A.10}
$$

When Xlite = 0,the operation reduces to the original convolutional representation, while Xlite = 1 enables full contextual refinement.Intermediate values allow fine-grained control over the contribution of long-range dependencies.

This formulation is shared across both YOLO and TATR architectures.In YOLO, the Lite Transformer is embedded within enhanced blocks at strategic backbone and neck stages to refine multi-scale feature representations.In TATR, the same module is selectively applied to early convolutional encoder layers, providing contextual awareness prior to transformer-based structural reasoning.

# F YOLO Training Results

Table 7: Performance comparison of YOLO architecture versions.   
![](images/b4a8f3661d17a7a0d6a72ab8f45ff21c8f2957445b95a1266c8df68805014edd.jpg)

# G TATR Training Results

Table 8: Performance comparison of TATR architecture versions.   
![](images/79422cd0b5c720ac31d3627a1d499033447e6bdd514a6d085aa3bf1d6f6dfd37.jpg)

# References

[1] Ifra Altaf, Muheet Ahmed Butt,and Majid Zaman. Etl for disease indicators using brute force rule-based nlp algorithm and metadata exploration. International Journal of Aduanced Technology and Engineering Exploration, 9:644-662, 2022. doi: 10.19101/ IJATEE.2021.875069. URL https://doi.0rg/10.19101/IJATEE.2021.875069.   
[2] Patrick Ferreira Barroso,Wilson'de Souza Melo Junior,Rodrigo Pereira David,and Luiz F.Rust da Costa Carmo.Benchmarking of table extraction models for calibration certificates._In Benchmarking of Table Extraction Models for Calibration Certif-cates, 2025. URL https://www.researchgate.net/publication/400485741_Benchmarkingof_table_extraction_models_for_calibration_certificates. Conference paper.   
[3] Shubham Borse,Youngjoon Kim,Mohamed R.Amer,and Fatih Porikli.Foura: Fourier low-rank adaptation for diffusion models. arXiv preprint arXiv:2406.08798, 2024.URL https://arxiv.org/abs/2406.08798.   
[4] Lang Cao and Hanbing Liu. Tablemaster: A recipe to advance table understanding with language models. arXiv preprint arXiv:2501.19378, 2025. doi: 10.48550/arXiv.2501. 19378. URL https://arxiv.org/abs/2501.19378.   
[5] Nicolas Carion, Francisco Massa, Gabriel Synnaeve, Nicolas Usunier,Alexander Kirillov, and Sergey Zagoruyko. End-to-End Object Detection with convolutios.In Lecture Notes in Computer Science (including subseries Lecture Notes in Artificial Intelligence and Lecture Notes in Bioinformatics), volume 12346 LNCS, pages 213-229. Facebook AI, 2020. ISBN 9783030584511. doi: 10.1007/978-3-030-58452-8_13. URL https://link. springer.c0m/10.1007/978-3-030-58452-8_13.   
[6]Bowen Cheng,Ross Girshick,Piotr Dollar,Alexander C. Berg,and Alexander Kirillov. Boundary iou: Improving object-centric image segmentation evaluation. In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), pages 15334-15342, 2021. doi: 10.1109/CVPR46437.2021.01511.   
[7] Xiangxiang_Chu, Bo Zhang, Zhi Tian, Xiaolin Wei, Huaxia Xia,and Chunhua Shen. Twins: Revisiting the design of spatial attention in vision transformers. In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR), pages 9355-9365,2021.   
[8] Kenneth Ward Church， Zeyu Chen，and Yanjun Ma.Emerging trends: A gentle introduction to fine-tuning.Natural Language Engineering, 27:763-778, 2021. doi: 10.1017/S1351324921000322. URL https://doi.org/10.1017/S1351324921000322.   
[9] Fergal Cotter and Nick Kingsbury. Deep learning in the wavelet domain, 2018. URL https://arxiv.org/abs/1811.06115.   
[10] Harsh Desai, Pratik'Kayal, and Mayank Singh. Tablex: A benchmark _dataset for structure and content information extraction from scientific tables.arXiu preprint arXiv:2105.06400, 2021. URL https://arxiv.0rg/abs/2105.06400.   
[11] Hao Dong,Shuwei Liu, Shikun Han, Zhipeng Fu,and Deli Zhang. Tablesense: Spreadsheet table detection with convolutional neural networks.In Proceedings of the AAAI Conference on Artificial Intelligence, 2019.   
[12] Adam Dziedzic, John Paparrizos,Sanjay Krishnan,Aaron Elmore,and Michael Franklin. Band-limited training and inference for convolutional neural networks.arXiu preprint arXiv:1911.09287, 2019. URL https://arxiv.0rg/abs/1911.09287.   
[13] Ana Landeta Echeberria. A Digital Framework for Industry 4.O: Managing Strategy.Palgrave Macmilan Cham,2020. ISBN 978-3-030-60048-8. doi: 10.1007/978-3-030-60049-5. URL https://link.springer.com/book/10.1007/978-3-030-60049-5.   
[14] Deng-Ping Fan, Ge-Peng Ji, Guolei Sun, Ming-Ming Cheng, Jianbing Shen,and Ling Shao.Camouflaged object detection.In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)， pages 2774-2784, 2020. doi: 10.1109/CVPR42600.2020.00285.   
[15] Mohammed S. Gadelrab and Reham A. Abouhogail. Towardsaaa a new generation of digital calibration certificate: Analysis and survey. Measurement:Journal of the International Measurement Confederation, 181(March):109611, 2021. ISSN 02632241. doi: 10.1016/j.measurement.2021.109611. URL https://doi.org/10.1016/j.measurement. 2021.109611.   
[16] Ian Goodfellow, Yoshua Bengio,and Aaron Courville. Deep Learning. Adaptive Computation and Machine Learning series. MIT Press, 2016. URL https://mitpress.mit.edu/ 9780262035613/deep-learning/

[17] Siegfried Hackel, Frank Hartig, Thorsten Schrader, Alexander Scheibner, Jan Loewe, Lutz Doering,Benjamin Gloger,Justin Jagieniak,Daniel Hutzschenreuter,and Gamze Soylev-Oktem. The fundamental architecture of the DCC.Measurement: Sensors,18: 100354， dec_2021.ISSN 26659174.doi: 10.1016/j.measen.2021.100354.URL https: //linkinghub.elsevier.com/retrieve/pii/S2665917421003172.   
[18] Yuna Han and Byung-Woo Hong.Deep_learning based on fourier convolutional neural network incorporating random kernels. Electronics,10(16):2004,2021.ISSN 2079-9292. doi: 10.3390/electronics10162004. URL https://www.mdpi.com/2079-9292/10/16/2004.   
[19] Edward JHu, Yelong Shen,Phillip_Wallis, Zeyuan Allen-Zhu, Yuanzhi Li,Shean Wang, and Lu Wang. Lora: Low-rank adaptation of large language models. arXiv preprint arXiv:2106.09685, 2021. URL https://arxiv.0rg/abs/2106.09685.   
[20] Zhipeng Huang, Zhizheng Zhang, Cuiling_Lan, Zheng-Jun Zha, Yan Lu,and Baining Guo. Adaptive frequency filters as efficient global token mixers.arXiu preprint arXiv:2307.14008, 2023.URL https://arxiv.0rg/abs/2307.14008.Accepted by ICCV 2023.   
[21] Rahima Khanam and Muhammad Hussain. Yolovl1: An overview of the key architectural enhancements. arXiv preprint arXiv:2410.17725, 2024. URL https://arxiv.org/ abs/2410.17725.License: CC BY 4.0.   
[22] Minghao Li,Lei Cui, Shaohan Huang, Furu Wei, Ming Zhou,and Zhoujun Li. Tablebank: A benchmark dataset for table detection and recognition. In Proceedings of the 12th Language Resources and Evaluation Conference, pages 1918-1925, 2020.   
[23] Guosheng Lin，Anton Milan,Chunhua Shen，and Ian Reid.Refinenet: Multipath refinement networks for high-resolution semantic segmentation.arXiu preprint arXiv:1611.06612, 2016. URL https://arxiv.0rg/abs/1611.06612.   
[24] Tsung-Yi Lin，Michael Maire,Serge Belongie,James Hays，Pietro Perona，Deva Ramanan,Piotr Dollar,and C.Lawrence Zitnick. Microsoft coco: Common objects in Context. In Proceedings of the European Conference on Computer Vision (ECCv),pages 740-755. Springer, 2014.   
[25] Weihong Lin, Zheng Sun, Chixiang Ma, Mingze Li, Jiawei Wang, Lei Sun,and Qiang Huo.TSRFormer. In Proceedings of the 30th ACM International Conference on Multimedia,volume 1，pages 6473-6482,New York，NY,USA，oct 2022.ACM.ISBN 9781450392037. doi: 10.1145/3503161.3548038. URL https://dl.acm.0rg/doi/10.1145/ 3503161.3548038.   
[26] Rosanne Liu, Joel Lehman,Piero Molino,Felipe Petroski Such,Eric Frank,Alex Sergeev, and Jason Yosinski. An intriguing failing of convolutional neural networks and the coordconv solution. arXiu preprint arXiv:1807.03247, 2018. doi: 10.48550/arXiv.1807. 03247. URL https://arxiv.org/abs/1807.03247.   
[27] Zhiwei Liu, Shijie Liu, Yidong Han, Zeyu Fan,Li Jiang,and Weisi Lin. Dora: Weightdecomposed low-rank adaptation.arXiu preprint arXiv:2402.09353, 2024. URL https: //arxiv.0rg/abs/2402.09353.   
[28] Rujiao Long,Wen Wang, Nan Xue, Feiyu Gao, Zhibo Yang, Yongpan Wang,and Gui-Song Xia.Parsing Table Structures in the Wild.In 202i IEEE/CVF International Conference on Computer Vision (ICCV), pages 924-932. IEEE, oct 2021. ISBN 978- 1-6654-2812-5. doi: 10.1109/ICCV48922.2021.00098.URL https://ieexplore.ieee.0rg/ document/9710258/.   
[29] Rabeeh Karimi Mahabadi, Sebastian Ruder,and James Henderson. Towards a unified view of parameter-efficient transfer learning. arXiv preprint arXiv:2110.04366, 2021. URL https://arxiv.org/abs/2110.04366.   
[30] National Library of Medicine. PMC Open Access Subset. https://www.ncbi.nlm.nih. gov/pmc/tools/openftlist/, 2023. Accessed: 2026-01-27.   
[31] Risto Paavola,Petri Hallikainen,and Amany Elbanna.Role of middle managers in modular digital transformation: The case of servu. In Proceedings of the 25th European Conference on Information Systems (ECIS), pages 887-903, Guimaraes, Portugal, June 5-10 2017. ISBN 978-989-20-7655-3. URL https://aisel.aisnet.0rg/ecis2017_rp/58.   
[32] Shubham Paliwal, D. Vishwanath, Rohit Rahul,Monika Sharma, and Lovekesh Vig. Tablenet: Deep learning model for end-to-end table detection and tabular data extraction from scanned document images. arXiu preprint arXiv:2001.01469, 2020. URL https: //arxiv.0rg/abs/2001.01469.   
[33] Xinyu Pan, Chen Zang,Wanxuan Lu, Guiyuan Jiang,and Qian Sun.Fsff-net: A frequency-domain feature and spatial-domain feature fusion network for hyperspectral

image classification. Electronics,14(11):2234, 2025.ISSN 2079-9292. doi: 10.3390/ electronics14112234. URL https://www.mdpi.com/2079-9292/14/11/2234.   
[34] ShengYun Peng, Aishwarya Chakravarthy, Seongmin Lee, Xiaojing Wang, Rajarajeswari Balasubramaniyan,and Duen Horng Chau. Unitable: Towards a unified framework for table recognition via self-supervised pretraining. 2024. doi: 10.48550/arXiv.2403.04822. URL https://arxiv.0rg/abs/2403.04822.   
[35] Federico Perazzi，Anna Khoreva,Rodrigo Benenson，Bernt Schiele,and_Alexander Sorkine-Hornung.Learning video object segmentation from static_images. In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR), pages 3491-3500, 2017. doi: 10.1109/CVPR.2017.372.   
[36] Yu Pu_and Biao Xu.Parameter-efficient fine-tuning of_transformer-based satellite onboard object detectors. arXiu preprint arXiv:2406.02385, 2024. URL https://arxiv. org/abs/2406.02385.   
[37] Xuebin Qin, Zichen Zhang, Chenyang Huang, Chao Gao, Masood Dehghan,and Martin Jagersand.Basnet: Boundary-aware salient object detection.In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), pages 7471-7481, 2019. doi: 10.1109/CVPR.2019.00766.   
[38] Abdellatif Sassioui, Rachid Benouini, Yasser El Ouargui, Mohamed El-Kamili, Meriyem Chergui, and Mohammed Ouzzif.Visually-rich document understanding: Concepts, taxonomy and challenges.In Proceedings of the 1Oth International Conference on Wireless Networks and Mobile Communications (WINCOM)， pages 1-7, 2023. doi: 10.1109/WINCOM59760.2023.10322990. URL https://dblp.org/rec/conf/wincom/ SassiouiBOECO23.   
[39] Luke T. Slater,Wiliam Bradlow,Dino FA.Motti, Robert Hoehndorf, Simon Ball,and Georgios V. Gkoutos.A fast,accurate,and generalisable heuristic-based negation detection algorithm for clinical text. Computers in Biology and Medicine,130:104216, 2021. doi: 10.1016/j.compbiomed.2021.104216. URL https://doi.org/10.1016/j.compbiomed. 2021.104216.   
[40] Brandon Smock and Rohith Pesala. Aligning benchmark datasets for table structure recognition.Journal of Machine Learning Research, 25:123-135, 2023.URL https: //arxiv.org/abs/2303.00716. Disponivel em: https://arxiv.0rg/abs/2303.00716. Acesso em: 28 abr. 2025.   
[41] Brandon Smock,Rohith Pesala,and Robin Abraham. PubTables-1M: Towards comprehensive table extraction from unstructured documents.Proceedings of the IEEE Computer Society Conference on Computer Vision and Pattern Recognition, 2022-June: 4624-4632，sep 2021.ISSN 10636919.doi: 10.1109/CVPR52688.2022.00459．URL http://arxiv.org/abs/2110.00061.   
[42] Narayanan Subramani, Arnaud Matton, Matthew Greaves, and Albert Lam. A survey_of deep learning approaches for ocr and document understanding. arXiv preprint arXiv:2011.13534, 2020.URL https://arxiv.0rg/abs/2011.13534.   
[43] Zhi Tian, Chunhua Shen, Hao Chen,and Tong He. Fcos: Fully_convolutional one-stage object detection. In Proceedings of the IEEE International Conference on Computer Vision (ICCV), pages 9627-9636, 2019.   
[44] Georges Vial.‘Understanding digital transformation: A review and a research agenda. Journal of Strategic Information Systems,28:118-144, 2019.   
[45] Jinxing Wang, Qing Li, Zhong Li, Yanhua Zhao, Fangyuan Fan,and Pengfei Shi.A deeply supervised attention metric-based network and an open aerial image dataset for remote sensing change detection. In 2021 IEEE International Geoscience and Remote Sensing Symposium (IGARSS)， pages 4507-4510, 2021. doi: 10.1109/IGARSS47720. 2021.9467555. URL https://ieeexplore.ieee.org/document/9467555.   
[46] Xiaoxiang Wang,Bo Li, Weiliang Yin_and Yi Sun. Adaptive wing loss for robust face alignment via heatmap regression.In Proceedings of the IEEE International Conference on Computer Vision (ICCV), pages 6977-6987, 2019.   
[47] Sanghyun Woo,Jongchan Park， Joon-Young Lee,and In So Kweon.Cbam: Convolutional block attention module.arXiv preprint arXiv:1807.06521, 2018.URL https://arxiv.org/abs/1807.06521.   
[48] Xiao-Kun Wu, Min Chen, Wanyi Li, Rui Wang, Limeng Lu, Jia Liu, Kai Hwang, and Yixue Hao.Llm fine-tuning: Concepts,opportunities,and challenges.arXiv preprint arXiv:2401.12345, 2024. URL https://arxiv.org/abs/2401.12345.   
[49] Zhanghao Wu, Zhijian Liu, Ji Lin, Yujun Lin,and'Song Han. Lite transformer with long-short range attention.arXiv preprint arXiv:2004.11886,2020.

[50] Geding Yan,Haitao Jing,Hui Li, Huanchao Guo,and Shi He.Enhancing building segmentation in remote sensing images: Advanced multi-scale boundary refinement with mbr-hrnet. Remote Sensing,15:3766,2023. doi: 10.3390/rs15153766. URL https://www. mdpi.c0m/2072-4292/15/15/3766.   
[51] Chenglin 'Yang, Yilin Wang, Jianming Zhang, He Zhang, Zijun Wei, Zhe Lin, and Alan Yuille.Lite vision transformer with enhanced self-attention.arXiv preprint arXiv:2112.10809.2022.   
[52] Fan Yang,Lei Hu, Xinwu Liu, Shuangping Huang,and Zhenghui Gu.A large-scale dataset for end-to-end table recognition in the wild.Scientific Data,10(1):110, feb 2023.ISSN 2052-4463. doi: 10.1038/s41597-023-01985-8. URL https://www.nature. com/articles/s41597-023-01985-8.   
[53] Dewei Yi, Hasan Bayarov Ahmedov, Shouyong Jiang, Yiren Li, Sean Joseph Flinn,and Paul G. Fernandes. Coordinate-aware mask r-cnn with group normalization: A underwater marine animal instance segmentation framework.Neurocomputing, 583:127488, 2024.ISSN 0925-2312. doi: 10.1016/j.neucom.2024.127488.URL https://doi.0rg/10. 1016/i.neucom.2024.127488. Open Access under CC BY license.   
[54] Longxuan Yu, Xiaofei Zhou, Lingbo Wang, and Jiyong Zhang. Boundary-aware salient object detection in optical remote-sensing images.Electronics,11(24):4200, 2022. doi: 10.3390/electronics11244200. URL https://www.mdpi.com/2079-9292/11/24/4200.   
[55] Jiayi Yuan, Hongye Li, Meng Wang, Ruyang Liu, Chuanyou Li, and Beilun Wang. An OpenCV-based Framework for Table Information Extraction.Proceedings -11th IEEE International Conference onKnowledge Graph,ICKG 2020,pages 621-628,2020.doi: 10.1109/ICBK50248.2020.00093.   
[56] Ning Zhang，Francesco Nex, George Vosselman，and Norman Kerle.Lite-mono: Alightweight cnn and transformer architecture for self-supervised monocular depth estimation. ISPRS Journal of Photogrammetry and Remote Sensing, pages 1-14,2023.   
[57] Jiayi Zhao,Alison Wun-lam Yeung, Ali Muhammad, Songjiang Lai, and Vincent To-Yee Ng. Cbam-swint-bl: Small rail surface defect detection method based on swin transformer with block level cbam enhancement. arXiu preprint arXiv:2409.20113, 2024. doi: 10. 48550/arXiv.2409.20113. URL https://arxiv.org/abs/2409.20113.   
[58] Xu Zhong, Elaheh ShafieiBavani,and'Antonio Jimeno Yepes. Image-Based Table Recognition: Data, Model,and Evaluation. In Lecture Notes in Computer Science (including subseries Lecture Notes in Artificial Intelligence and Lecture Notes in Bioinformatics), volume 12366 LNCS,pages 564-580.ECVA,2020.ISBN 9783030585884.doi: 10.1007/ 978-3-030-58589-1_34. URL https://link.springer.com/10.1007/978-3-030-58589-1_34.   
[59] Xu Zhong，Elaheh ShafieiBavani,'and Antonio Jimeno Yepes.Image-based table recognition: data,model,and evaluation.arXiu preprint arXiu:1911.10683,2020.   
[60] Xingkui Zhu, Shuchang Lyu, Xu Wang,and Qi Zhao. Tph-yolov5: Improved yolov5 based on transformer prediction head for object detection on drone-captured scenarios.In Proceedings of the IEEE/CVF International Conference on Computer Vision Workshops(VisDrone)，pages 2778-2788，2021. URL https://openaccess.thecvf. com/content/ICCV2021W/VisDrone/papers/Zhu_TPH-YOLOv5_Improved_YOLOv5_ Based_on_Transformer_Prediction_Head_for_Object_ICCVW_2021-paper.pdf.   
[61] Nabila Zrira, Anwar Jimi, Mario Di Nardo, Issam Elaf, Maryam Gallab,and Redouan Chahdi El Ouazzani. Gcbam-unet:Sun glare segmentation using convolutional block attention module. Applied System Innovation, 7(6):128, 2024.ISSN 2571-5577.doi: 10.3390/asi7060128. URL https://www.mdpi.com/2571-5577/7/6/128.
