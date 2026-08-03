#!/usr/bin/env python3
"""Minimal internal OCR HTTP API wrapping OCRmyPDF + Tesseract.
Not for public exposure. Endpoints: GET /health, POST /ocr

Query/form params:
  languages=por+eng
  force=true|false
  quality=standard|high   (high = deskew/rotate/clean/oversample; for retries only)
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_file

app = Flask(__name__)

OCR_LANGUAGES = os.environ.get("OCR_LANGUAGES", "por+eng")
OCR_TIMEOUT = int(os.environ.get("OCR_TIMEOUT_SECONDS", "180"))
OCR_TIMEOUT_HQ = int(os.environ.get("OCR_TIMEOUT_HQ_SECONDS", str(OCR_TIMEOUT + 120)))
MAX_UPLOAD_BYTES = int(os.environ.get("OCR_MAX_UPLOAD_BYTES", str(40 * 1024 * 1024)))
WORK_DIR = Path(os.environ.get("OCR_WORK_DIR", "/tmp/ocr-work"))
WORK_DIR.mkdir(parents=True, exist_ok=True)


def _tesseract_langs() -> list[str]:
    try:
        out = subprocess.check_output(
            ["tesseract", "--list-langs"],
            stderr=subprocess.STDOUT,
            text=True,
            timeout=15,
        )
        lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
        return [
            ln
            for ln in lines
            if not ln.lower().startswith("list of available languages")
            and not ln.endswith("):")
        ]
    except Exception:
        return []


def _ocrmypdf_version() -> str:
    try:
        out = subprocess.check_output(["ocrmypdf", "--version"], text=True, timeout=10)
        return out.strip()
    except Exception:
        return "unknown"


@app.get("/health")
def health():
    langs = _tesseract_langs()
    return jsonify(
        {
            "ok": True,
            "service": "oftalmocentro-ocr",
            "engine": "ocrmypdf+tesseract",
            "ocrmypdfVersion": _ocrmypdf_version(),
            "languagesInstalled": langs,
            "defaultLanguages": OCR_LANGUAGES,
            "timeoutSeconds": OCR_TIMEOUT,
            "modes": ["STANDARD", "HIGH_QUALITY"],
            "features": {
                "deskew": True,
                "rotatePages": True,
                "clean": True,
                "cleanFinal": True,
                "optimize": True,
                "oversample": True,
                "forceOcr": True,
                "redoOcr": True,
            },
        }
    )


@app.post("/ocr")
def ocr():
    started = time.time()
    languages = (
        request.form.get("languages")
        or request.args.get("languages")
        or OCR_LANGUAGES
    ).strip()
    force = str(
        request.form.get("force") or request.args.get("force") or "false"
    ).lower() in {"1", "true", "yes"}
    quality_raw = (
        request.form.get("quality") or request.args.get("quality") or "standard"
    ).strip().lower()
    high_quality = quality_raw in {"high", "high_quality", "hq", "high-quality"}
    mode_label = "HIGH_QUALITY" if high_quality else "STANDARD"
    timeout = OCR_TIMEOUT_HQ if high_quality else OCR_TIMEOUT

    job_id = str(uuid.uuid4())
    job_dir = WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    in_path = job_dir / "input.pdf"
    out_path = job_dir / "output.pdf"

    try:
        f = request.files.get("file") or request.files.get("file0")
        if f is not None:
            f.save(in_path)
        elif request.data:
            in_path.write_bytes(request.data)
        else:
            return jsonify(
                {"ok": False, "code": "FILE_REQUIRED", "message": "Arquivo é obrigatório."}
            ), 400

        size = in_path.stat().st_size
        if size <= 0:
            return jsonify({"ok": False, "code": "FILE_EMPTY", "message": "Arquivo vazio."}), 400
        if size > MAX_UPLOAD_BYTES:
            return jsonify(
                {"ok": False, "code": "FILE_TOO_LARGE", "message": "Arquivo excede o limite do OCR."}
            ), 413

        with open(in_path, "rb") as fh:
            head = fh.read(5)
        if not head.startswith(b"%PDF"):
            return jsonify(
                {"ok": False, "code": "FILE_TYPE_NOT_ALLOWED", "message": "OCR aceita apenas PDF."}
            ), 400

        cmd = [
            "ocrmypdf",
            "--language",
            languages,
            "--output-type",
            "pdf",
            "--jobs",
            "1",
            "--tesseract-timeout",
            str(max(30, timeout - 30)),
        ]

        if high_quality:
            # retry mode only — slower, higher quality
            cmd.extend(
                [
                    "--optimize",
                    "1",
                    "--deskew",
                    "--rotate-pages",
                    "--clean",
                    "--clean-final",
                    "--oversample",
                    "300",
                    "--force-ocr",
                ]
            )
        else:
            cmd.extend(["--optimize", "1"])
            if force:
                cmd.append("--force-ocr")
            else:
                cmd.append("--skip-text")

        cmd.extend([str(in_path), str(out_path)])

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if proc.returncode == 6 and not out_path.exists():
            shutil.copyfile(in_path, out_path)
        elif proc.returncode not in (0, 6) or not out_path.exists():
            err = (proc.stderr or proc.stdout or "").strip()[:800]
            lower = err.lower()
            code = "OCR_FAILED"
            if "password" in lower or "encrypted" in lower:
                code = "FILE_PASSWORD_PROTECTED"
            elif "prior ocr" in lower or "already" in lower:
                code = "OCR_NOT_NEEDED"
            return jsonify({"ok": False, "code": code, "message": "Falha no OCR.", "detail": err}), 422

        digest = hashlib.sha256(out_path.read_bytes()).hexdigest()
        duration_ms = int((time.time() - started) * 1000)
        resp = send_file(
            out_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{job_id}-ocr.pdf",
        )
        resp.headers["X-OCR-Checksum"] = digest
        resp.headers["X-OCR-Duration-Ms"] = str(duration_ms)
        resp.headers["X-OCR-Engine"] = "ocrmypdf+tesseract"
        resp.headers["X-OCR-Languages"] = languages
        resp.headers["X-OCR-Job-Id"] = job_id
        resp.headers["X-OCR-Mode"] = mode_label
        return resp
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "code": "OCR_TIMEOUT", "message": "Tempo limite do OCR excedido."}), 504
    except Exception as exc:
        return jsonify({"ok": False, "code": "OCR_FAILED", "message": "Erro interno no OCR.", "detail": str(exc)[:300]}), 500
    finally:
        if os.environ.get("OCR_KEEP_TEMP", "0") != "1":
            shutil.rmtree(job_dir, ignore_errors=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
