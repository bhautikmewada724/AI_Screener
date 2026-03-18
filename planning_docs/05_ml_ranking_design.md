# ML & Ranking System Design

## 1. Core Philosophy: "Evidence-Based Hybrid Search"
We reject "Black Box" AI. Every score must be traceable to specific evidence in the text.
**Approach**: `Lexical (Precision) + Semantic (Recall) + LLM Verification (Reasoning)`

## 2. The Ranking Pipeline

### Stage 1: Parsing & Structuring (The "Reader")
- **Input**: PDF/Docx.
- **Process**:
  1. **OCR/Text Extraction**: AWS Textract or Tesseract (for image PDFs) + `pypdf`.
  2. **Structure Extraction**: Use a small, fine-tuned LLM (or GPT-4o-mini) to extract JSON:
     - `Skills` (Normalized)
     - `WorkExperience` (Company, Title, Duration, Description)
     - `Education`
  3. **PII Detection**: Identify and tag Name, Email, Phone, University (for potential masking).

### Stage 2: Retrieval (The "Filter")
*Goal: Quickly narrow 1000 candidates to 50.*
- **Method**: Hybrid Score = `(0.7 * Lexical_Score) + (0.3 * Semantic_Score)`
- **Lexical**: Existing `RSE` logic. Does candidate have "Python" and "5 years"?
- **Semantic**: `SentenceTransformers` (all-MiniLM-L6-v2) embedding of Resume Summary vs JD Summary. Captures "Frontend" ~= "UI Dev".

### Stage 3: Re-Ranking (The "Judge")
*Goal: Analyzing the top 50 in depth.*
- **Method**: LLM-based verification.
- **Prompt**: "Does this candidate's experience at [Company] regarding [Skill] actually demonstrate proficiency? Rate 1-5 and cite the sentence."
- **Output**: A "Confidence Score" and "Evidence Snippet".

## 3. Evaluation Framework
*How do we know it works?*

### Metrics
1.  **Precision@K**: Of the top K candidates, how many are actually relevant?
2.  **Recall@K**: Did we miss any great candidates in the top K?
3.  **NDCG**: Are the *best* candidates at the very top?

### The "Golden Dataset" Strategy
1.  **Creation**: Take 50 old anonymized resumes + 1 JD.
2.  **Labeling**: Have 3 senior recruiters manually rank them (1-5 stars) and agree on a consensus.
3.  **Benchmark**: Run the AI pipeline. Compute correlation (Spearman's Rank) between AI and Human consensus.
4.  **Gate**: AI must achieve >0.8 correlation to pass "Model Sanity Check".

## 4. Bias & Fairness
- **Proxy Analysis**: Check if scores correlate with non-predictive features (e.g., zip code, name length, university prestige).
- **Disparate Impact Testing**:
  - Run the model on a synthetic dataset of identical resumes with swapped names (Male vs Female, Ethnic vs Anglophone).
  - **Pass Condition**: Score variance < 1%.
- **Explainability**: The UI *must* show the breakdown. "Score 85/100: +20 for Java (Strong), +10 for AWS (Weak), -5 for Missing 'Kubernetes'".
