import json
from typing import Dict, Optional


class GuidanceParser:
    """
    Helper to parse OpenAI guidance output (v2 schema) and extract general summaries per zodiac sign.
    Handles common formatting issues such as code fences.
    """

    @staticmethod
    def _clean_text_blob(text_blob: str) -> str:
        cleaned = text_blob.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        return cleaned

    @classmethod
    def load_json(cls, content: str) -> Optional[object]:
        """
        Attempt to parse a JSON string, tolerating code fences.
        """
        if not isinstance(content, str):
            return None
        try:
            return json.loads(content)
        except Exception:
            pass
        try:
            cleaned = cls._clean_text_blob(content)
            return json.loads(cleaned)
        except Exception:
            return None

    @staticmethod
    def extract_general_summaries(payload: dict, target_lang: str) -> Dict[str, str]:
        """
        Given a parsed payload (v2 schema), return {zodiacSign: general summary}.
        """
        result: Dict[str, str] = {}
        blocks = payload.get("languageBlocks") or []
        for block in blocks:
            if block.get("language") != target_lang:
                continue
            preds = block.get("zodiacPredictions") or []
            for pred in preds:
                code = pred.get("zodiacSign")
                summary = "No guidance returned."
                # v2 schema can provide either `predictions` (single phase) or `timeFrames` (multi-phase)
                flat_predictions = pred.get("predictions") or []
                if flat_predictions:
                    for p in flat_predictions:
                        if p.get("category", "").lower() == "general":
                            if p.get("summary"):
                                summary = p["summary"]
                                break
                            if p.get("prediction"):
                                summary = p["prediction"]
                                break
                if summary == "No guidance returned.":
                    frames = pred.get("timeFrames") or []
                    for frame in frames:
                        for p in frame.get("predictions") or []:
                            if p.get("category", "").lower() == "general":
                                if p.get("summary"):
                                    summary = p["summary"]
                                    break
                                if p.get("prediction"):
                                    summary = p["prediction"]
                                    break
                        if summary != "No guidance returned.":
                            break
                if code:
                    result[code] = summary
        return result
