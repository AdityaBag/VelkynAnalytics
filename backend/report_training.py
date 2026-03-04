from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
import json
import re

from docx import Document as DocxDocument
from pdfminer.high_level import extract_text as pdf_extract_text

SUPPORTED_TRAINING_EXTS = {".pdf", ".docx", ".txt", ".md"}

_STOP_WORDS = {
    "the", "and", "for", "that", "with", "from", "this", "into", "using", "are", "was", "were", "been",
    "have", "has", "had", "not", "but", "you", "your", "our", "their", "its", "about", "than", "then",
    "over", "under", "through", "between", "per", "can", "could", "should", "would", "also", "such", "these",
    "those", "which", "while", "where", "when", "what", "after", "before", "within", "without", "onto", "across",
}


def slugify(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "report"


def extract_text_from_file(path: Path) -> str:
    ext = path.suffix.lower()
    if ext not in SUPPORTED_TRAINING_EXTS:
        raise ValueError(f"Unsupported training file extension: {ext}")

    if ext in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="replace")

    if ext == ".docx":
        doc = DocxDocument(str(path))
        return "\n".join(p.text for p in doc.paragraphs if p.text and p.text.strip())

    if ext == ".pdf":
        return pdf_extract_text(str(path))

    return ""


def detect_headings(text: str) -> list[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    headings: list[str] = []

    for line in lines:
        if len(line) < 4 or len(line) > 120:
            continue

        looks_numbered = bool(re.match(r"^\d+(?:\.\d+)*[\)\.]?\s+", line))
        looks_markdown = line.startswith("#")
        looks_colon = line.endswith(":")
        looks_upper = line.isupper() and len(line.split()) <= 10
        looks_title = line[:1].isupper() and len(line.split()) <= 10 and line.count(".") <= 1

        if looks_numbered or looks_markdown or looks_colon or looks_upper or looks_title:
            clean = line.lstrip("#").strip(" :-\t")
            if clean and clean not in headings:
                headings.append(clean)

        if len(headings) >= 40:
            break

    return headings


def detect_tone(text: str) -> dict[str, Any]:
    corpus = text.lower()
    tone_buckets = {
        "formal": ["therefore", "furthermore", "accordingly", "hence", "notwithstanding", "assumption"],
        "academic": ["hypothesis", "methodology", "empirical", "literature", "theorem", "statistical"],
        "risk-focused": ["stress", "downside", "tail", "var", "drawdown", "breach", "risk"],
        "research": ["alpha", "signal", "factor", "backtest", "benchmark", "outperformance"],
        "sell-side": ["coverage", "target price", "investment view", "rating", "catalyst", "street"],
    }

    scores = {name: sum(corpus.count(token) for token in tokens) for name, tokens in tone_buckets.items()}
    dominant = max(scores, key=lambda key: scores[key]) if scores else "formal"
    if scores and scores.get(dominant, 0) == 0:
        dominant = "formal"

    return {"scores": scores, "dominant": dominant}


def detect_narrative_patterns(text: str) -> dict[str, Any]:
    corpus = text.lower()
    methodology = bool(re.search(r"\b(methodology|approach|model|framework|process)\b", corpus))
    results = bool(re.search(r"\b(result|output|finding|observation|performance)\b", corpus))
    interpretation = bool(re.search(r"\b(interpretation|implication|insight|discussion|conclusion)\b", corpus))

    flow = "methodology → results → interpretation" if methodology and results and interpretation else "partial"
    return {
        "methodology": methodology,
        "results": results,
        "interpretation": interpretation,
        "flow": flow,
    }


def extract_example_paragraphs(text: str, limit: int = 5) -> list[str]:
    pieces = re.split(r"\n\s*\n+", text)
    samples: list[str] = []
    for block in pieces:
        paragraph = " ".join(block.split())
        if len(paragraph) < 180:
            continue
        samples.append(paragraph)
        if len(samples) >= limit:
            break
    return samples


def detect_common_phrases(text: str, limit: int = 20) -> list[str]:
    words = [w.lower() for w in re.findall(r"[A-Za-z]{3,}", text)]
    words = [w for w in words if w not in _STOP_WORDS]
    if len(words) < 2:
        return []

    bigrams = Counter(zip(words, words[1:]))
    phrases = [f"{a} {b}" for (a, b), count in bigrams.most_common(limit * 2) if count >= 2]
    return phrases[:limit]


def build_style_profile(report_type: str, docs: list[dict[str, Any]]) -> dict[str, Any]:
    full_text = "\n\n".join((doc.get("text") or "") for doc in docs)
    headings = detect_headings(full_text)
    tone = detect_tone(full_text)
    narrative = detect_narrative_patterns(full_text)
    examples = extract_example_paragraphs(full_text)
    phrases = detect_common_phrases(full_text)

    structure_ok = len(headings) >= 3
    tone_ok = sum(tone.get("scores", {}).values()) >= 2
    narrative_ok = all(
        [
            narrative.get("methodology", False),
            narrative.get("results", False),
            narrative.get("interpretation", False),
        ]
    )
    examples_ok = len(examples) >= 2
    ready = bool(docs) and structure_ok and tone_ok and narrative_ok and examples_ok

    files_meta = [
        {
            "name": d.get("name"),
            "path": d.get("path"),
            "size": d.get("size", 0),
            "chars": d.get("chars", 0),
            "uploaded_at": d.get("uploaded_at"),
        }
        for d in docs
    ]

    return {
        "report_type": report_type,
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "doc_count": len(docs),
        "total_chars": sum(int(d.get("chars", 0)) for d in docs),
        "files": files_meta,
        "structure": {"headings": headings[:30]},
        "tone": tone,
        "narrative": narrative,
        "common_phrases": phrases,
        "example_paragraphs": examples,
        "capabilities": {
            "structure": structure_ok,
            "tone": tone_ok,
            "narrative": narrative_ok,
            "examples": examples_ok,
            "ready": ready,
        },
    }


def save_style_profile(profile_path: Path, profile: dict[str, Any]) -> None:
    profile_path.parent.mkdir(parents=True, exist_ok=True)
    profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")


def load_style_profile(profile_path: Path) -> dict[str, Any] | None:
    if not profile_path.exists():
        return None
    try:
        return json.loads(profile_path.read_text(encoding="utf-8"))
    except Exception:
        return None
