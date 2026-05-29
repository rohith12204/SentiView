#  AI System Overview

The system is divided into three major AI components:

1. Sentiment Analysis Model
2. Fake Review Detection System
3. Analytics and Summarization Engine

---

# 1. Sentiment Analysis Model

### Model Overview

The sentiment analysis component is built using **DistilBERT**, a transformer-based NLP model that uses self-attention mechanisms to understand the contextual meaning of text. Instead of training from scratch, we applied **transfer learning** by fine-tuning a pre-trained DistilBERT model for a three-class classification task: negative, neutral, and positive.

### Input Processing

The input to the model is raw review text. This text is processed using a **WordPiece tokenizer**, which converts it into numerical tokens. The sequences are padded and truncated to a fixed length to ensure uniform input size for the model.

### Prediction Mechanism

The model outputs **logits**, which are raw scores for each class. These logits are passed through a **Softmax function** to convert them into a probability distribution. The class with the highest probability is selected as the predicted sentiment, and the corresponding probability is treated as the confidence score.

### Output

The system produces:

* Predicted sentiment label (negative, neutral, positive)
* Confidence score
* Probability distribution across all classes

---

## 📌 Controlled Inference Layer

### 🔹 Language Filtering

Before making predictions, the system checks whether the input text is in English. This ensures reliability since the model is trained only on English data.

### 🔹 Confidence Thresholding

A confidence threshold of **0.6** is applied. If the model’s confidence is below this threshold, the prediction is marked as **“uncertain”** instead of forcing a potentially incorrect classification.

### 🔹 Neutral Handling

Neutral predictions are also treated as **“uncertain”**, as they do not provide strong sentiment polarity for decision-making.

## 📌 Key Insight

This is not just a basic prediction system. It is a **controlled inference pipeline**, where model outputs are filtered and validated using language detection and confidence thresholds to ensure more reliable and meaningful sentiment predictions.

---

# 2.Fake Review Detection System

### What is Used

The system uses a **hybrid approach** combining:

* A **rule-based detection system** (primary)
* A **DistilBERT-based binary classification model** (secondary)

---

### a. Rule-Based Detection (Primary Engine)

### How It Works

The rule-based system is built using **feature engineering and pattern matching**. It analyzes the review text to detect predefined signals associated with fake or genuine reviews.

### 🔹 Fake Signals Detected

The system checks for patterns such as:

* Promotional language (e.g., “buy now”, “discount”)
* Spam content (URLs, emails, phone numbers)
* Incentivized reviews (e.g., “got this for free”)
* Rating–sentiment mismatch
* Generic or low-effort reviews (e.g., “best product ever”)
* Imperative or push language (e.g., “must buy”)
* Platform-directed praise (e.g., “thanks Amazon”)
* Competitor attacks or troll-like content
* Repetitive or robotic text patterns


### 🔹 Genuine Signals Detected

To improve accuracy, it also detects genuine indicators such as:

* Real usage context (e.g., “used for 2 weeks”)
* Specific product details (battery, camera, etc.)
* Numerical information (e.g., “40 minutes”, “80%”)
* Balanced opinions (e.g., “but”, “however”)



### Scoring Mechanism

Each detected signal contributes to a **risk score**:

* Fake signals increase the score
* Genuine signals reduce the score

The final score is normalized between **0 and 100**.



###  Decision Logic

* Risk score ≥ 40 → Classified as **Fake**
* Risk score < 40 → Classified as **Genuine**

---

## b.Machine Learning Model (Secondary Layer)

### What is Used

A **DistilBERT transformer model** is fine-tuned for **binary classification**:

* 0 → Real
* 1 → Fake



### How It Works

* The input review text is tokenized and converted into numerical representations
* The model processes the input using transformer layers
* It produces logits, which are converted into probabilities using Softmax
* The class with the highest probability is selected as the prediction


### 🔴 Final Working

The system primarily relies on the **rule-based scoring mechanism** for decision-making because it is more interpretable and controllable. The ML model acts as a **supporting layer** to capture contextual patterns that rules may miss.

Overall, the detection works by combining:

* **Feature-engineered rule-based scoring** for explainability
* **Transformer-based classification** for contextual understanding

to accurately classify whether a review is fake or genuine.

---

# 3. Dataset Pipeline (Data Engineering Layer)

### What is Used

The system uses a **data preprocessing and data engineering pipeline** built using:

* **Pandas** for data handling and transformation
* **TextBlob** for basic sentiment labeling
* A **rule-based fake detection function** for labeling fake reviews


### What Happens

The pipeline takes **multiple raw datasets** from different sources such as:

* Amazon
* Flipkart
* Kaggle

These datasets have **different formats and column structures**, so they are unified into a single structured format:

```text
brand | model | review_text | rating | sentiment | is_fake
```

### How It Works (Step-by-Step)


### i. Data Loading

Multiple CSV files are loaded from different sources.


### ii. Data Cleaning

* Remove null or empty reviews
* Normalize text fields
* Ensure consistent data types


### iii. Standardization

* Product names are cleaned and standardized
* Brand and model fields are made consistent across datasets


### iv. Sentiment Generation

* If sentiment is not available, it is generated using **TextBlob polarity**
* If text-based sentiment is unavailable, it is inferred from the **rating value**


### v. Fake Labeling

* Each review is passed through a **rule-based fake detection function**
* It assigns:

  * 1 → Fake
  * 0 → Genuine


### vi. Deduplication

* Duplicate reviews are removed based on:

  * Review text
  * Product model


### vii. Handling Missing Values

* Missing ratings are filled using sentiment-based approximations


### viii. Final Dataset Creation

* All processed data is combined into a single dataset
* Saved as a structured CSV file for training and analysis


## 📌 Key Insight

This pipeline ensures that **heterogeneous raw data is transformed into a clean, consistent, and labeled dataset**, which is essential for training machine learning models and performing reliable analytics.


## 🔴 One-Line Summary

> “The dataset pipeline is a data engineering process that integrates multiple raw data sources, cleans and standardizes them, generates sentiment and fake labels, and produces a unified dataset for model training and analysis.”
---

# 4. Analytics Engine

### What is Used

The analytics component is built using:

* Pandas for data aggregation and computation
* Outputs from previous modules (sentiment + fake detection)

### How It Works

### 1. Fake Review Filtering
* All reviews are first passed through the fake detection system
* Reviews marked as fake are removed
* Only genuine reviews are used for further analysis

### 2. Metric Computation

From the filtered dataset, the system computes:

* Total Reviews → Count of genuine reviews
* Sentiment Percentage → Percentage of positive reviews
* Average Rating → Mean of ratings

### 3. Aspect-Based Scoring

The system calculates scores for different product aspects such as:

* Camera
* Battery
* Performance
* Display
* Design

These scores are derived by:

* Taking the average of aspect-related ratings
* Scaling them into a standardized score


### 📌 Key Insight
The analytics engine ensures that all insights are based only on clean, trustworthy data, improving the reliability of results by eliminating fake reviews before computation.
---

# 4. Summary Generation

### What is Used

The summarization component uses keyword extraction and statistical NLP techniques, not deep learning or generative AI.

### How It Works

### 1. Review Segmentation
Reviews are divided into:
* Positive reviews
* Negative reviews

### 2. Keyword Extraction
* Frequently occurring words are extracted from each group
* Common stopwords and irrelevant terms are removed

### 3. Pros and Cons Generation
* Pros → Derived from keywords in positive reviews
* Cons → Derived from keywords in negative reviews

### 4. Summary Construction
A final summary is generated using a template-based approach, such as:

“Based on X reviews, the product has Y% positive sentiment. Users highlight A, B, C as strengths, while concerns include D, E.”

### 📌 Key Insight

This is not generative AI. It is a deterministic, keyword-based summarization approach, which ensures consistency and interpretability.

### 🔴 One-Line Summary

“The analytics engine computes insights from genuine reviews, and the summarization module uses keyword-based statistical methods to generate pros, cons, and an overall product summary.”



---


# 🔴 Final Presentation Speech (ML/AI Explanation)

“The system is divided into three major AI components: a sentiment analysis model, a fake review detection system, and an analytics and summarization engine.

First, the sentiment analysis component is built using DistilBERT, which is a transformer-based NLP model that uses self-attention to understand the contextual meaning of text. We fine-tuned this pre-trained model using transfer learning for a three-class classification task: negative, neutral, and positive. The input review text is tokenized and passed through the model, which produces probability scores using a Softmax function. The class with the highest probability is selected as the prediction. On top of this, we implemented a controlled inference layer where we apply language filtering and a confidence threshold of 0.6. If the confidence is low or the prediction is neutral, it is marked as uncertain to improve reliability.

Second, the fake review detection system uses a hybrid approach. The primary component is a rule-based system built using feature engineering and pattern matching. It detects fake signals such as promotional language, spam content, incentivized reviews, rating–sentiment mismatch, and generic or robotic text. It also detects genuine signals like real usage context, specific details, and balanced opinions. Each signal contributes to a risk score between 0 and 100. If the score is above a threshold, the review is classified as fake. In addition to this, we use a DistilBERT-based binary classification model that learns patterns from data to classify reviews as real or fake. This model complements the rule-based system by capturing contextual patterns.

Third, the dataset pipeline acts as the data engineering layer. It integrates multiple raw datasets from sources like Amazon and Flipkart, cleans and standardizes them, generates sentiment labels using TextBlob or ratings, and assigns fake labels using the rule-based detector. The data is unified into a consistent format and used for training and analysis.

Finally, the analytics engine processes only genuine reviews by filtering out fake ones first. It computes metrics such as total reviews, sentiment percentage, average rating, and aspect-based scores like camera, battery, and performance. The summarization module then uses keyword-based statistical NLP techniques to extract frequent terms from positive and negative reviews, generating pros, cons, and a structured summary.

Overall, the system combines transformer-based deep learning models with rule-based logic and data engineering to produce reliable and interpretable insights from review data.”
