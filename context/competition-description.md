# Problem Description

---

- Extracting structured tables from document images is a fundamental challenge in document understanding and information retrieval. Tables appear in financial reports, invoices, bank statements, research papers, and forms, yet their layouts vary significantly in structure, style, and complexity.
- The goal of this competition is to develop robust AI models capable of detecting tables in document images and accurately reconstructing their structural and textual content.
- You’re asked to design an end-to-end systems that transform raw document images into structured table representations suitable for downstream data processing.

# Team Formation

---

- Each team must consist of 3 to 5 members.
- Teams should collectively cover all essential skill sets required for success in the competition.
- Participants may form teams either through the competition’s community discussion channels or with support from the technical team.

# Model Testing Phases

## Table Detection & Structure Recognition

---

### **Input**

- Images containing tables extracted from:
    - Scientific papers
    - Financial documents

### **Output**

- The table bounding box and its structured representation, expressed as a set of bounding boxes corresponding to each cell.

### **Evaluation Criteria**

- Intersection over Union (IoU)
- Mean Average precision (mAP)
- F1-Score

### **Timeline**:

- **Implementation Phase Begins:** February 16
- **Submission & Leaderboard Release:** February 20
- **Leaderboard closes:** March 2

## Text Extraction

---

### **Goal:**

- Introducing more challenging data samples for the Table Detection and Table Structure Recognition models.
- Extract the cells text content mapped to its correct cell position.

### **Output:**

- CSV for file with recognized text corresponding to each table cell.

### **Evaluation Criteria:**

- Word Error Rate (WER)
- Character Error Rate (CER)
- Grid Table Similarity (GriTS)

### **Timeline**:

- **Evaluation Phase Begins:** March 3
- **Duration:** Ends after Eid & Midterms freeze

# Deployment

---

- After the model testing phases, teams will finalize their solutions and deploy them as fully functional applications.

# Machathon Day

---

- Teams qualified to the final phase can enhance model quality and receive feedbacks.
- Teams must design a poster showcasing their innovation.
- Creativity and presentation quality will be part of the final evaluation.
- **Machathon 7.0 Final Event Date:** 17/4

# Rules & Regulations

---

- Teams must build their own custom models or fine-tune open-source solutions .
- APIs for extracting or recognizing handwriting are not permitted.
- Each team gets two submissions per day; leaderboard updates occur within 24 hours.
- If a new submission scores lower, the leaderboard retains the previous best score.
- Teams must ensure models are lightweight and efficient to avoid performance penalties.

# Technical Support & Inquiries

---

- Throughout the competition, the Technical Support Team will be available to assist participants with any questions or difficulties they encounter.
- The team will provide guidance on:
- Competition rules and submission guidelines.
    - Model evaluation and expected outcomes.
    - Addressing technical challenges during development.
    - Ensuring fairness and compliance with the regulations.
- For any inquiries, participants can reach out to the Technical Support Team , who will be actively monitoring and assisting teams during all phases of the Machathon.