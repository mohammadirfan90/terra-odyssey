"""Phase 6: Grounded AI Narrative Summarizer using NVIDIA NIM.

LLM: nvidia/nemotron-3-super-120b-a12b (default; override with NVIDIA_NIM_MODEL env var)
API: OpenAI-compatible endpoint at https://integrate.api.nvidia.com/v1
Auth: NVIDIA_API_KEY environment variable (never embedded in source)

Scientific grounding rules (non-negotiable):
  - The LLM receives ONLY verified statistical outputs as structured evidence.
  - No hallucination guard-rail is needed beyond strict prompt engineering because
    the model is given no external internet access — only the InvestigationRecord.
  - If trend is "inconclusive" or "ineligible", the summary must say so explicitly.
  - The LLM must not assert causation; it can only describe co-occurrence or correlation.
  - Uncertainty intervals, p-values, and effect sizes must be quoted verbatim from the record.
  - "Not significant" is not "no change"; the summary must include effect size and CI.
  - All summaries are marked with the model ID and prompt version for reproducibility.
"""

from __future__ import annotations

import os
import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("terra_odyssey.backend.ai_narrator")

# --------------------------------------------------------------------------- #
# Configuration                                                                 #
# --------------------------------------------------------------------------- #
_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"
_DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b"
_PROMPT_VERSION = "v1.0.0"

# Max tokens for the summary — long enough for scientific detail, short enough to
# avoid irrelevant padding.
_MAX_TOKENS = 1024
_TEMPERATURE = 0.2   # low temperature for factual, reproducible text
_TOP_P = 0.9


# --------------------------------------------------------------------------- #
# System prompt                                                                 #
# --------------------------------------------------------------------------- #
_SYSTEM_PROMPT = """\
You are a scientific data analyst for the Terra Odyssey Earth System Trend Detective application.
Your task is to write a concise, factual narrative summary of a completed Earth system trend investigation.

STRICT RULES — NEVER VIOLATE:
1. Use ONLY the statistical evidence provided in the JSON below. Do NOT add external facts.
2. Do NOT assert causation. You may describe co-occurrence, correlation, or statistical association.
3. Quote the provided slope, confidence interval, and p-value verbatim (units must match).
4. If result_status is "inconclusive" or "ineligible", the summary MUST explicitly state that.
5. If a trend is "not significant" (p >= 0.05), do NOT describe it as absent. State the effect size and CI.
6. Do NOT use vague language like "shows a trend" without citing the quantitative evidence.
7. Separate the dataset, period, region, and statistical result clearly.
8. The final paragraph must include a one-sentence data-source attribution.
9. Keep the summary to 3–5 paragraphs, ≤ 350 words.
10. Use plain English suitable for a scientifically literate general audience.
"""

_USER_PROMPT_TEMPLATE = """\
Write a narrative summary for the following investigation:

```json
{evidence_json}
```

The summary must follow all 10 rules in the system prompt.
"""


# --------------------------------------------------------------------------- #
# Evidence builder                                                              #
# --------------------------------------------------------------------------- #

def build_evidence_payload(investigation_record: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the minimal, grounded evidence payload from an InvestigationRecord.

    Only verified statistical fields are forwarded to the LLM — no raw data arrays,
    no intermediate computation artefacts.
    """
    job = investigation_record.get("job", {})
    req = investigation_record.get("request", {})
    results = investigation_record.get("results", [])
    provenance = investigation_record.get("provenance", {})

    dataset_id = req.get("dataset_id") or job.get("dataset_id")
    variable = req.get("variable") or job.get("variable")
    period = req.get("period") or job.get("period", {})
    region_a = req.get("region_a") or job.get("region_a")
    region_b = req.get("region_b") or job.get("region_b")
    result_status = job.get("result_status") or investigation_record.get("result_status", "supported")

    citations = investigation_record.get("citations", [])
    doi = provenance.get("doi")
    if not doi and citations:
        first_c = citations[0]
        doi = first_c.get("doi") if isinstance(first_c, dict) else str(first_c)

    evidence: Dict[str, Any] = {
        "dataset": provenance.get("dataset_name", dataset_id or "NASA Observation"),
        "dataset_id": dataset_id,
        "variable": variable,
        "period": period,
        "region_a": region_a,
        "region_b": region_b,
        "result_status": result_status,
        "data_source": provenance.get("source_type", "NASA dataset"),
        "doi": doi,
        "results": [],
    }

    for result in results:
        effect = result.get("effect", {})
        unc = result.get("uncertainty", {})
        method = result.get("method", {})
        cov = result.get("coverage", {})
        interp = result.get("interpretation", {})

        slope = effect.get("estimate") if "estimate" in effect else result.get("slope_per_decade")
        slope_units = effect.get("unit_per_decade") if "unit_per_decade" in effect else result.get("slope_units")
        ci_lower = unc.get("lower") if "lower" in unc else (result.get("ci_95", [None, None])[0] if result.get("ci_95") else None)
        ci_upper = unc.get("upper") if "upper" in unc else (result.get("ci_95", [None, None])[1] if result.get("ci_95") else None)
        p_val = method.get("p_value") or method.get("decision_p_value") or result.get("p_value")

        r: Dict[str, Any] = {
            "region": result.get("region_label", result.get("region", "Region A")),
            "status": result.get("status"),
            "n_years": cov.get("valid_periods") or result.get("n_years"),
            "slope_per_decade": round(float(slope), 4) if slope is not None else None,
            "slope_units": slope_units,
            "ci_95_lower": round(float(ci_lower), 4) if ci_lower is not None else None,
            "ci_95_upper": round(float(ci_upper), 4) if ci_upper is not None else None,
            "p_value": float(p_val) if p_val is not None else None,
            "interpretation": interp.get("text"),
            "autocorrelation_correction": method.get("dependence_treatment") or result.get("autocorrelation_correction"),
        }
        # Paired contrast
        if "contrast" in result:
            contrast = result["contrast"]
            r["contrast"] = {
                "delta_slope_per_decade": contrast.get("delta_slope_per_decade"),
                "delta_ci_95": contrast.get("delta_ci_95"),
                "delta_p_value": contrast.get("delta_p_value"),
                "contrast_status": contrast.get("status"),
            }
        evidence["results"].append(r)

    return evidence


# --------------------------------------------------------------------------- #
# NIM client                                                                    #
# --------------------------------------------------------------------------- #

class NvidiaAINarrator:
    """Grounded AI narrative summarizer backed by NVIDIA NIM Nemotron.

    Usage:
        narrator = NvidiaAINarrator()
        summary = narrator.generate_summary(investigation_record)
    """

    def __init__(
        self,
        model: Optional[str] = None,
        base_url: str = _NIM_BASE_URL,
        timeout: float = 60.0,
        max_retries: int = 2,
    ) -> None:
        self.model = model or os.environ.get("NVIDIA_NIM_MODEL", _DEFAULT_MODEL)
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries
        self._api_key: Optional[str] = None

    def _get_api_key(self) -> str:
        """Read the NVIDIA API key from environment at call time (never cached in source)."""
        key = os.environ.get("NVIDIA_API_KEY", "")
        if not key:
            raise EnvironmentError(
                "NVIDIA_API_KEY environment variable is not set. "
                "Generate an NGC API key at https://ngc.nvidia.com/ and set it in your environment."
            )
        return key

    def _build_client(self):
        """Build an OpenAI-compatible client pointed at the NVIDIA NIM endpoint."""
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise ImportError(
                "The 'openai' package is required for AI narrative generation. "
                "Install it with: pip install openai>=1.0"
            ) from exc
        return OpenAI(base_url=self.base_url, api_key=self._get_api_key())

    def generate_summary(
        self,
        investigation_record: Dict[str, Any],
        extra_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a grounded AI narrative summary for a completed investigation.

        Parameters
        ----------
        investigation_record : dict
            The full InvestigationRecord JSON from the artifacts directory.
        extra_context : str, optional
            Optional additional plaintext context (e.g. region name, season) to
            append to the user prompt. Must not contain hallucinated data.

        Returns
        -------
        dict with keys:
            summary_text      : str — the generated narrative
            model             : str — model ID used
            prompt_version    : str — prompt version for reproducibility
            evidence_payload  : dict — the grounded evidence forwarded to the LLM
            tokens_used       : int — total tokens consumed
            latency_ms        : int — wall-clock generation time in milliseconds
            error             : str | None — set if generation failed
        """
        import json

        evidence = build_evidence_payload(investigation_record)
        evidence_json = json.dumps(evidence, indent=2, default=str)
        user_prompt = _USER_PROMPT_TEMPLATE.format(evidence_json=evidence_json)
        if extra_context:
            user_prompt += f"\n\nAdditional context: {extra_context}"

        result: Dict[str, Any] = {
            "summary_text": None,
            "model": self.model,
            "prompt_version": _PROMPT_VERSION,
            "evidence_payload": evidence,
            "tokens_used": None,
            "latency_ms": None,
            "error": None,
        }

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                client = self._build_client()
                t0 = time.perf_counter()
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=_TEMPERATURE,
                    top_p=_TOP_P,
                    max_tokens=_MAX_TOKENS,
                )
                latency_ms = int((time.perf_counter() - t0) * 1000)
                summary_text = response.choices[0].message.content or ""
                tokens_used = (
                    response.usage.total_tokens if response.usage else None
                )
                result["summary_text"] = summary_text.strip()
                result["tokens_used"] = tokens_used
                result["latency_ms"] = latency_ms
                logger.info(
                    "AI narrative generated: model=%s tokens=%s latency=%dms attempt=%d",
                    self.model, tokens_used, latency_ms, attempt + 1,
                )
                return result
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "AI narrative generation attempt %d/%d failed: %s",
                    attempt + 1, self.max_retries + 1, exc,
                )
                if attempt < self.max_retries:
                    time.sleep(2.0 * (attempt + 1))  # exponential back-off

        result["error"] = str(last_exc)
        logger.error("AI narrative generation failed after %d attempts: %s", self.max_retries + 1, last_exc)
        return result

    def is_available(self) -> bool:
        """Return True if the NVIDIA API key is configured in the environment."""
        return bool(os.environ.get("NVIDIA_API_KEY", ""))
