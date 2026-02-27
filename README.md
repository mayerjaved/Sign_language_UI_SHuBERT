# 2-Way Sign Language Translation App — Full Architecture Plan

> **Purpose**: This document is a comprehensive, developer-handoff-ready specification for building and locally deploying a 2-Way Sign Language Translation web application. It is designed to be given to a frontend developer, a backend developer, or another AI assistant with no prior context on this project.

---

## Table of Contents

1.  [Product Overview](#1-product-overview)
2.  [What Already Exists (ML Engine)](#2-what-already-exists-ml-engine)
3.  [Proposed Directory Structure](#3-proposed-directory-structure)
4.  [Backend Architecture (Python / FastAPI)](#4-backend-architecture-python--fastapi)
5.  [Frontend Architecture (Next.js / React)](#5-frontend-architecture-nextjs--react)
6.  [Model Weights & Checkpoint Organization](#6-model-weights--checkpoint-organization)
7.  [Interaction Flow: Gesture ➔ Text](#7-interaction-flow-gesture--text)
8.  [Interaction Flow: Text ➔ Avatar](#8-interaction-flow-text--avatar)
9.  [Local Deployment Guide](#9-local-deployment-guide)
10. [GPU Capacity & Performance](#10-gpu-capacity--performance)
11. [Future: Cloud Scaling](#11-future-cloud-scaling)

---

## 1. Product Overview

The app is a **two-way messaging interface** where:

| Direction | Input | Output |
|-----------|-------|--------|
| **Gesture ➔ Text** | User records video of themselves signing | App translates to English text |
| **Text ➔ Avatar** | User types English text | App plays a 3D avatar performing the sign language |

Users can select from multiple sign languages (ASL, Turkish SL, Pakistani SL, etc.).

### Constraints & Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MAX_RECORDING_SECONDS` | `10` | Maximum duration (in seconds) a user can record a video. The frontend auto-stops recording at this limit. Users can stop early. This value is adjustable in one place (`src/lib/config.ts` on the frontend and as an env var on the backend). |
| `ALLOWED_VIDEO_FORMATS` | `.mp4, .webm, .mov` | Accepted video upload formats. |
| `MAX_UPLOAD_SIZE_MB` | `50` | Maximum file size for uploaded videos (enforced server-side). |

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│                                                                     │
│  ┌──────────────────┐              ┌──────────────────────────────┐ │
│  │   Webcam Feed    │              │    3D Avatar Canvas          │ │
│  │   (WebRTC)       │              │    (Three.js / Unity WebGL)  │ │
│  └────────┬─────────┘              └──────────────▲───────────────┘ │
│           │                                       │                 │
│  ┌────────▼───────────────────────────────────────┴───────────────┐ │
│  │              Chat UI  (React / Next.js)                        │ │
│  │  [Language Selector] [Record Button] [Text Input] [Send]       │ │
│  └────────┬───────────────────────────────────────┬───────────────┘ │
└───────────┼───────────────────────────────────────┼─────────────────┘
            │  HTTP POST /api/translate_video        │  HTTP POST /api/generate_avatar
            │  (video file + lang)                   │  (text + lang)
            ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PYTHON BACKEND (FastAPI)                         │
│                     http://localhost:8000                            │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  /api/translate_video                                          │ │
│  │  1. Receive .mp4/.webm + lang                                  │ │
│  │  2. Load correct checkpoint for lang                           │ │
│  │  3. Run: Video → MediaPipe → DINOv2 → SHuBERT → ByT5 → Text  │ │
│  │  4. Return JSON: {"text": "Hello, how are you?"}               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  /api/generate_avatar  (Phase 2 — future)                     │ │
│  │  1. Receive text + lang                                        │ │
│  │  2. Map text to sign animations                                │ │
│  │  3. Return animation data (JSON keyframes or glTF)             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  GPU: NVIDIA Titan RTX 24GB VRAM                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. What Already Exists (ML Engine)

The most complex part of this project — the machine learning inference pipeline — **is already built and running locally**. A developer picking this up does NOT need to train models or write ML code.

### Existing Files (in `SHuBERT_transferLearning/`)

| File | Purpose |
|------|---------|
| `features.py` | **Core orchestrator**. Contains `SHuBERTProcessor` class that takes a video path and returns English text. This is the main function the backend API will call. |
| `inference.py` | ByT5 decoder — takes SHuBERT embeddings and generates text byte-by-byte. |
| `shubert.py` | SHuBERT encoder model definition. |
| `kpe_mediapipe.py` | MediaPipe landmark detection (face, hands, body pose). |
| `crop_face.py` | Crops face regions from video frames using landmarks. |
| `crop_hands.py` | Crops hand regions from video frames using landmarks. |
| `dinov2_features.py` | Extracts 384-dim visual embeddings using DINOv2. |
| `body_features.py` | Processes body pose landmarks into feature vectors. |
| `test_translate.py` | CLI script to test translation: `python test_translate.py "video.mp4"` |
| `asl_translator.py` | Gradio-based web UI for translation (can be used as reference). |
| `launcher.py` | Simpler Gradio launcher script. |
| `download_models.py` | Downloads all model weights from HuggingFace. |

### Existing Model Weights (in `SHuBERT_ckpts/`)

| File | Size | Purpose |
|------|------|---------|
| `checkpoint_836_400000.pt` | 1.0 GB | SHuBERT encoder (pre-trained on ASL) |
| `checkpoint-11625/` | 7.6 GB | ByT5 decoder (fine-tuned for ASL→English) |
| `byt5_base/` | 2.2 GB | ByT5 tokenizer |
| `face_dinov2_checkpoint.pth` | 108 MB | DINOv2 face feature extractor |
| `hands_dinov2_checkpoint.pth` | 108 MB | DINOv2 hand feature extractor |
| `yolov8n.pt` | 6.2 MB | YOLOv8 person detection |
| `face_landmarker_v2_with_blendshapes.task` | 11 MB | MediaPipe face model |
| `hand_landmarker.task` | 7.5 MB | MediaPipe hand model |

### Existing CONFIG Dictionary (from `test_translate.py`)

This is the exact dictionary that the `SHuBERTProcessor` class expects. The backend API must construct this and pass it in:

```python
MODELS_DIR = Path("SHuBERT_ckpts")

CONFIG = {
    'yolov8_model_path':          str(MODELS_DIR / "yolov8n.pt"),
    'dino_face_model_path':       str(MODELS_DIR / "face_dinov2_checkpoint.pth"),
    'dino_hands_model_path':      str(MODELS_DIR / "hands_dinov2_checkpoint.pth"),
    'mediapipe_face_model_path':  str(MODELS_DIR / "face_landmarker_v2_with_blendshapes.task"),
    'mediapipe_hands_model_path': str(MODELS_DIR / "hand_landmarker.task"),
    'shubert_model_path':         str(MODELS_DIR / "checkpoint_836_400000.pt"),
    'slt_model_config':           str(MODELS_DIR / "byt5_base" / "config.json"),
    'slt_model_checkpoint':       str(MODELS_DIR / "checkpoint-11625"),
    'slt_tokenizer_checkpoint':   str(MODELS_DIR / "byt5_base"),
    'temp_dir':                   str(Path("temp"))
}
```

### Transfer Learning Status

| Language | Status | Checkpoint Location |
|----------|--------|---------------------|
| **ASL (American)** | ✅ Ready | `SHuBERT_ckpts/checkpoint-11625/` |
| **TRSL (Turkish)** | 🔄 In Progress | `trsl_ckpts/best_model/` (partially trained) |
| **PSL (Pakistani)** | 📋 Planned | Scripts exist in `psl/`, not yet trained |

When TRSL/PSL training completes, the backend simply needs to point `slt_model_checkpoint` to the new language's checkpoint folder.

---

## 3. Proposed Directory Structure

```
C:\code_projects\
│
├── SHuBERT_transferLearning/          ← EXISTING (ML ENGINE / BACKEND)
│   ├── SHuBERT_ckpts/                 ← Model weights (DO NOT MOVE)
│   │   ├── checkpoint_836_400000.pt
│   │   ├── checkpoint-11625/          ← ASL decoder checkpoint
│   │   ├── byt5_base/
│   │   ├── face_dinov2_checkpoint.pth
│   │   ├── hands_dinov2_checkpoint.pth
│   │   ├── yolov8n.pt
│   │   ├── face_landmarker_v2_with_blendshapes.task
│   │   └── hand_landmarker.task
│   │
│   ├── trsl_ckpts/                    ← TRSL decoder checkpoint (in progress)
│   │   └── best_model/
│   │       ├── config.json
│   │       ├── generation_config.json
│   │       └── pytorch_model.bin      ← 2.5 GB
│   │
│   ├── psl_ckpts/                     ← PSL decoder checkpoint (future)
│   │
│   ├── features.py                    ← Core: SHuBERTProcessor class
│   ├── inference.py                   ← ByT5 decoder
│   ├── shubert.py                     ← SHuBERT encoder
│   ├── kpe_mediapipe.py               ← MediaPipe landmarks
│   ├── crop_face.py                   ← Face extraction
│   ├── crop_hands.py                  ← Hand extraction
│   ├── dinov2_features.py             ← DINOv2 embeddings
│   ├── body_features.py               ← Body pose processing
│   │
│   ├── api.py                         ← [NEW] FastAPI backend server
│   ├── requirements_api.txt           ← [NEW] Backend-specific deps
│   │
│   ├── trsl/                          ← Transfer learning scripts (TRSL)
│   ├── psl/                           ← Transfer learning scripts (PSL)
│   ├── trsl_extracted_features/       ← Extracted TRSL feature tensors
│   ├── Dockerfile                     ← Docker for training
│   ├── docker-compose.yml
│   └── requirements.txt
│
├── sign-language-ui/                  ← [NEW] FRONTEND (Next.js)
│   ├── public/
│   │   └── avatars/                   ← 3D avatar models (.glb/.gltf)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx             ← Root layout (fonts, metadata)
│   │   │   ├── page.tsx               ← Main chat page
│   │   │   └── globals.css            ← Global styles
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx         ← Message bubbles, scroll area
│   │   │   ├── VideoRecorder.tsx      ← Webcam capture component
│   │   │   ├── AvatarPlayer.tsx       ← Three.js avatar renderer
│   │   │   ├── LanguageSelector.tsx   ← Dropdown for ASL/TRSL/PSL
│   │   │   ├── TextInput.tsx          ← Text message input bar
│   │   │   └── MessageBubble.tsx      ← Individual chat bubble
│   │   ├── lib/
│   │   │   ├── api.ts                 ← fetch() wrappers for backend
│   │   │   └── types.ts              ← TypeScript interfaces
│   │   └── hooks/
│   │       └── useMediaRecorder.ts    ← Custom hook for webcam
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
└── start_app.ps1                      ← [NEW] One-click launcher script
```

---

## 4. Backend Architecture (Python / FastAPI)

### Overview

The backend is a thin **FastAPI wrapper** around the existing `SHuBERTProcessor` class. Its job is to:
1. Accept HTTP requests from the frontend.
2. Save the uploaded video to a temp file.
3. Pass it through the ML pipeline.
4. Return the translated text as JSON.

### New File: `api.py`

```python
"""
Sign Language Translation API
Wraps SHuBERTProcessor in a FastAPI server.

Run with: uvicorn api:app --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import tempfile, shutil, os

# Set env vars BEFORE importing ML modules
SCRIPT_DIR = Path(__file__).parent
os.environ["TRANSFORMERS_CACHE"] = str(SCRIPT_DIR / "SHuBERT_ckpts" / ".cache")
os.environ["HF_HOME"] = str(SCRIPT_DIR / "SHuBERT_ckpts" / ".cache")

from features import SHuBERTProcessor

app = FastAPI(title="Sign Language Translation API")

# Allow the Next.js frontend (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Configuration ─────────────────────────────────────────────
MODELS_DIR = SCRIPT_DIR / "SHuBERT_ckpts"

# Map language codes to their decoder checkpoint paths
LANGUAGE_CHECKPOINTS = {
    "ASL": str(MODELS_DIR / "checkpoint-11625"),
    "TRSL": str(SCRIPT_DIR / "trsl_ckpts" / "best_model"),
    # "PSL": str(SCRIPT_DIR / "psl_ckpts" / "best_model"),  # uncomment when ready
}

SUPPORTED_LANGUAGES = list(LANGUAGE_CHECKPOINTS.keys())

BASE_CONFIG = {
    'yolov8_model_path':          str(MODELS_DIR / "yolov8n.pt"),
    'dino_face_model_path':       str(MODELS_DIR / "face_dinov2_checkpoint.pth"),
    'dino_hands_model_path':      str(MODELS_DIR / "hands_dinov2_checkpoint.pth"),
    'mediapipe_face_model_path':  str(MODELS_DIR / "face_landmarker_v2_with_blendshapes.task"),
    'mediapipe_hands_model_path': str(MODELS_DIR / "hand_landmarker.task"),
    'shubert_model_path':         str(MODELS_DIR / "checkpoint_836_400000.pt"),
    'slt_model_config':           str(MODELS_DIR / "byt5_base" / "config.json"),
    'slt_tokenizer_checkpoint':   str(MODELS_DIR / "byt5_base"),
    'temp_dir':                   str(SCRIPT_DIR / "temp"),
}

# Lazy-loaded processor cache (one per language)
processors: dict[str, SHuBERTProcessor] = {}

def get_processor(lang: str) -> SHuBERTProcessor:
    """Get or create a processor for the given language."""
    if lang not in processors:
        config = {**BASE_CONFIG, 'slt_model_checkpoint': LANGUAGE_CHECKPOINTS[lang]}
        processors[lang] = SHuBERTProcessor(config)
    return processors[lang]

# ── API Endpoints ────────────────────────────────────────────────────

@app.get("/api/languages")
def list_languages():
    """Return list of supported sign languages."""
    return {"languages": SUPPORTED_LANGUAGES}

# ── Configurable Constraints ─────────────────────────────────────────
MAX_RECORDING_SECONDS = int(os.environ.get("MAX_RECORDING_SECONDS", "10"))  # ← ADJUST THIS
MAX_UPLOAD_SIZE_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "50"))

@app.get("/api/config")
def get_config():
    """Return configurable app settings (consumed by frontend)."""
    return {
        "max_recording_seconds": MAX_RECORDING_SECONDS,
        "max_upload_size_mb": MAX_UPLOAD_SIZE_MB,
    }

@app.post("/api/translate_video")
async def translate_video(
    video: UploadFile = File(...),
    lang: str = Form("ASL")
):
    """
    Translate a sign language video to English text.

    - **video**: The video file (.mp4, .webm, .mov)
    - **lang**: Language code (ASL, TRSL, PSL)
    """
    if lang not in LANGUAGE_CHECKPOINTS:
        raise HTTPException(400, f"Unsupported language: {lang}. Choose from: {SUPPORTED_LANGUAGES}")

    # Validate file size
    contents = await video.read()
    if len(contents) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"Video too large. Max {MAX_UPLOAD_SIZE_MB} MB.")

    # Validate duration (server-side check)
    suffix = Path(video.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        import decord
        vr = decord.VideoReader(tmp_path)
        duration = len(vr) / vr.get_avg_fps()
        if duration > MAX_RECORDING_SECONDS + 1:  # +1s tolerance
            raise HTTPException(400, f"Video too long ({duration:.1f}s). Max {MAX_RECORDING_SECONDS}s.")

        processor = get_processor(lang)
        result_text = processor.process_video(tmp_path)
        return {"text": result_text, "lang": lang}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Translation failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    import torch
    return {
        "status": "ok",
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "vram_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1) if torch.cuda.is_available() else 0,
        "languages": SUPPORTED_LANGUAGES,
    }
```

### Backend Dependencies (`requirements_api.txt`)

```
fastapi
uvicorn[standard]
python-multipart
```

> **Note**: All ML dependencies (`torch`, `transformers`, `fairseq`, `mediapipe`, etc.) are already in the existing `requirements.txt`.

### API Endpoint Summary

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/languages` | — | `{"languages": ["ASL", "TRSL"]}` |
| `GET` | `/api/config` | — | `{"max_recording_seconds": 10, "max_upload_size_mb": 50}` |
| `POST` | `/api/translate_video` | `multipart/form-data`: `video` (file) + `lang` (string) | `{"text": "Hello", "lang": "ASL"}` |
| `GET` | `/api/health` | — | `{"status": "ok", "gpu": "NVIDIA TITAN RTX", ...}` |
| `POST` | `/api/generate_avatar` | *(Phase 2 — future)* | *(animation keyframes or glTF data)* |

---

## 5. Frontend Architecture (Next.js / React)

### Setup

```powershell
# Create the frontend project (run from C:\code_projects\)
npx -y create-next-app@latest sign-language-ui --typescript --tailwind --app --eslint
```

### Component Breakdown

| Component | File | Responsibility |
|-----------|------|----------------|
| **ChatWindow** | `ChatWindow.tsx` | Scrollable area displaying all message bubbles (both text and video). |
| **VideoRecorder** | `VideoRecorder.tsx` | Accesses the user's webcam via `navigator.mediaDevices.getUserMedia()`. Has "Record", "Stop", and "Send" buttons. Produces a `Blob` of the recorded video. **Auto-stops at `MAX_RECORDING_SECONDS`** (default 10s). Shows a live countdown timer (e.g., "0:07 / 0:10"). User can click "Stop" early at any time. |
| **AvatarPlayer** | `AvatarPlayer.tsx` | Three.js canvas that loads a `.glb` avatar model and plays sign language animations. *(Phase 2)* |
| **LanguageSelector** | `LanguageSelector.tsx` | Dropdown menu populated by calling `GET /api/languages`. Stores the selected language in React state. |
| **TextInput** | `TextInput.tsx` | Text input bar at the bottom of the chat for typing messages (used for Text→Avatar direction). |
| **MessageBubble** | `MessageBubble.tsx` | Renders a single chat message. Shows video thumbnail for sent gestures, text for received translations. |

### Frontend Config (`src/lib/config.ts`)

```typescript
// ── Adjustable App Settings ─────────────────────────────────────────
// Change MAX_RECORDING_SECONDS here to adjust the recording limit globally.
export const MAX_RECORDING_SECONDS = 10;   // ← ADJUST THIS VALUE
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```

### Custom Hook: `useMediaRecorder.ts`

```typescript
import { useRef, useState, useCallback, useEffect } from "react";
import { MAX_RECORDING_SECONDS } from "@/lib/config";

export function useMediaRecorder() {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

    const startRecording = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            setVideoBlob(blob);
            stream.getTracks().forEach((t) => t.stop());
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setElapsed(0);

        // Auto-stop after MAX_RECORDING_SECONDS
        timerRef.current = setInterval(() => {
            setElapsed((prev) => {
                if (prev + 1 >= MAX_RECORDING_SECONDS) {
                    stopRecording();
                }
                return prev + 1;
            });
        }, 1000);
    }, []);

    const stopRecording = useCallback(() => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    return { isRecording, elapsed, videoBlob, startRecording, stopRecording, maxSeconds: MAX_RECORDING_SECONDS };
}
```

### API Client (`src/lib/api.ts`)

```typescript
import { API_BASE } from "@/lib/config";

export async function translateVideo(videoBlob: Blob, lang: string): Promise<string> {
    const formData = new FormData();
    formData.append("video", videoBlob, "recording.webm");
    formData.append("lang", lang);

    const res = await fetch(`${API_BASE}/api/translate_video`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) throw new Error(`Translation failed: ${res.statusText}`);
    const data = await res.json();
    return data.text;
}

export async function getLanguages(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/languages`);
    const data = await res.json();
    return data.languages;
}
```

### Frontend Data Flow

```
1. User selects "TRSL" from LanguageSelector
2. User clicks "Record" in VideoRecorder → starts webcam capture
3. User clicks "Stop" → MediaRecorder produces a Blob
4. User clicks "Send" → calls translateVideo(blob, "TRSL")
5. Frontend shows "Translating..." spinner in a new MessageBubble
6. Backend returns {"text": "..."} → MessageBubble updates with text
```

---

## 6. Model Weights & Checkpoint Organization

### Key Principle: All Weights Stay in One Place

All model weights live under `SHuBERT_transferLearning/`. The frontend project (`sign-language-ui/`) contains **zero** model files. The backend loads them from disk into GPU VRAM at startup.

### Adding a New Language

When a new language checkpoint is trained:

1. Place the checkpoint folder (containing `config.json`, `generation_config.json`, `pytorch_model.bin`) into a new folder:
   ```
   SHuBERT_transferLearning/
   └── <lang>_ckpts/
       └── best_model/
           ├── config.json
           ├── generation_config.json
           └── pytorch_model.bin
   ```

2. Add the language to the `LANGUAGE_CHECKPOINTS` dictionary in `api.py`:
   ```python
   LANGUAGE_CHECKPOINTS = {
       "ASL":  str(MODELS_DIR / "checkpoint-11625"),
       "TRSL": str(SCRIPT_DIR / "trsl_ckpts" / "best_model"),
       "PSL":  str(SCRIPT_DIR / "psl_ckpts" / "best_model"),  # ← add this
   }
   ```

3. Restart the backend. The new language will automatically appear in the frontend's language dropdown.

### Shared vs. Language-Specific Weights

```
Shared (loaded once, used by ALL languages):
  ├── SHuBERT encoder          checkpoint_836_400000.pt
  ├── DINOv2 face              face_dinov2_checkpoint.pth
  ├── DINOv2 hands             hands_dinov2_checkpoint.pth
  ├── YOLOv8n                  yolov8n.pt
  ├── MediaPipe face           face_landmarker_v2_with_blendshapes.task
  ├── MediaPipe hands          hand_landmarker.task
  └── ByT5 tokenizer           byt5_base/

Language-Specific (swapped per language):
  ├── ASL decoder              SHuBERT_ckpts/checkpoint-11625/
  ├── TRSL decoder             trsl_ckpts/best_model/
  └── PSL decoder              psl_ckpts/best_model/         (future)
```

---

## 7. Interaction Flow: Gesture ➔ Text

```
┌──────────┐     ┌───────────┐     ┌──────────────────────────────────┐     ┌──────────┐
│  Browser  │────►│  FastAPI   │────►│  SHuBERTProcessor.process_video  │────►│  Browser  │
│  .webm    │     │  /api/     │     │                                  │     │  "Hello"  │
│  + "TRSL" │     │  translate │     │  MediaPipe → DINOv2 → SHuBERT   │     │           │
│           │     │  _video    │     │  → ByT5 (TRSL ckpt) → text      │     │           │
└──────────┘     └───────────┘     └──────────────────────────────────┘     └──────────┘
```

**Detailed steps inside `SHuBERTProcessor.process_video()`:**

1. **Video Loading** (`decord`): Read all frames from the uploaded video.
2. **Landmark Detection** (`kpe_mediapipe.py`): Extract face (478 pts), hand (21 pts × 2), and body (33 pts) landmarks from every frame.
3. **Region Cropping** (`crop_hands.py`, `crop_face.py`): Crop hands and face regions from each frame using the detected landmarks.
4. **Feature Extraction** (`dinov2_features.py`): Pass cropped images through DINOv2 to get 384-dim embeddings for face, left hand, and right hand.
5. **Pose Processing** (`body_features.py`): Convert body pose landmarks into feature vectors.
6. **Translation** (`inference.py`): Feed all 4 streams (face, left hand, right hand, body) through the SHuBERT encoder, then decode with ByT5 into English text.

---

## 8. Interaction Flow: Text ➔ Avatar

> **Status: Phase 2 (Future Work)**

This direction requires a separate pipeline that does NOT yet exist. Options to implement:

| Approach | Complexity | Quality |
|----------|------------|---------|
| **Pre-recorded clips** | Low | Medium — Map common words/phrases to pre-animated avatar clips and concatenate them. |
| **Pose generation model** | High | High — Train a text-to-pose model that generates skeleton keyframes, then animate a 3D avatar. |
| **Hybrid** | Medium | Medium-High — Use a dictionary of sign language glosses (e.g., from sign language databases), map text to glosses via NLP, then play corresponding animations. |

When ready, this would be exposed via a `POST /api/generate_avatar` endpoint.

---

## 9. Local Deployment Guide

### Prerequisites

- **OS**: Windows 10/11
- **GPU**: NVIDIA Titan RTX (24 GB VRAM) with CUDA drivers installed
- **Python**: 3.10 (required for fairseq compatibility)
- **Node.js**: 18+ (for the Next.js frontend)

### Step-by-Step Startup

#### Terminal 1: Start the Backend (Python)

```powershell
cd C:\code_projects\SHuBERT_transferLearning

# Activate the Python 3.10 virtual environment
.venv310\Scripts\Activate.ps1

# Install the API dependencies (first time only)
pip install fastapi uvicorn[standard] python-multipart

# Start the API server
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be live at `http://localhost:8000`. You can test it by visiting `http://localhost:8000/api/health` in a browser.

#### Terminal 2: Start the Frontend (Next.js)

```powershell
cd C:\code_projects\sign-language-ui

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

The frontend will be live at `http://localhost:3000`.

#### One-Click Launcher Script (`start_app.ps1`)

```powershell
# Start both servers in split terminals
Write-Host "Starting Sign Language Translation App..." -ForegroundColor Cyan

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\code_projects\SHuBERT_transferLearning; .venv310\Scripts\Activate.ps1; uvicorn api:app --host 0.0.0.0 --port 8000"

# Wait for backend to initialize
Start-Sleep -Seconds 5

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\code_projects\sign-language-ui; npm run dev"

# Open browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host "App started! Backend: :8000 | Frontend: :3000" -ForegroundColor Green
```

### Custom Domain Deployment

To serve the app on a custom domain (e.g., `signlanguage.app`) while running on your local Titan RTX:

#### Step 1: Buy a Domain
Purchase a domain from any registrar (Namecheap, Cloudflare, Google Domains, etc.).

#### Step 2: Point DNS to Your IP
In your registrar's DNS settings, create an **A Record** pointing your domain to your public IP address:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_PUBLIC_IP` | Auto |
| A | `api` | `YOUR_PUBLIC_IP` | Auto |

> Find your public IP by visiting https://whatismyip.com

#### Step 3: Port Forwarding (Router)
In your router's admin panel (usually `192.168.1.1`), forward:
- **Port 80** → `your-PC-local-IP:80`
- **Port 443** → `your-PC-local-IP:443`

#### Step 4: Install Caddy (Reverse Proxy + Auto-HTTPS)
[Caddy](https://caddyserver.com/) is the simplest reverse proxy — it automatically provisions free HTTPS certificates from Let's Encrypt.

```powershell
# Install Caddy via Chocolatey
choco install caddy
```

Create a `Caddyfile` in `C:\code_projects\`:

```
# Caddyfile — serves your domain with automatic HTTPS

yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Start Caddy:
```powershell
caddy run --config C:\code_projects\Caddyfile
```

Caddy will automatically:
- Obtain and renew free HTTPS certificates from Let's Encrypt.
- Serve your Next.js frontend at `https://yourdomain.com`.
- Proxy API requests from `https://api.yourdomain.com` to your FastAPI backend.

#### Step 5: Update Frontend Environment Variable

In `sign-language-ui/.env.local`:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### Step 6: Update Backend CORS

In `api.py`, update the allowed origins:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://yourdomain.com",       # ← add your domain
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Alternative: Cloudflare Tunnel (No Port Forwarding Needed)

If you don't want to open ports on your router, use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) instead:

```powershell
# Install cloudflared
choco install cloudflared

# Authenticate with Cloudflare (one-time)
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create signlang-app

# Route your domain to the tunnel
cloudflared tunnel route dns signlang-app yourdomain.com
cloudflared tunnel route dns signlang-app api.yourdomain.com

# Run the tunnel
cloudflared tunnel --name signlang-app --url http://localhost:3000
```

This securely exposes your local app to the internet without opening any router ports, and Cloudflare handles HTTPS automatically.

---

## 10. GPU Capacity & Performance

### VRAM Budget (NVIDIA Titan RTX — 24 GB)

| Component | VRAM Usage |
|-----------|------------|
| Static: SHuBERT encoder | ~1.0 GB |
| Static: ByT5 decoder (one language) | ~2.3 GB |
| Static: DINOv2 (face + hands) | ~0.4 GB |
| Static: YOLOv8n + MediaPipe | ~0.2 GB |
| OS / Display overhead | ~1.5 GB |
| **Total Static** | **~5.4 GB** |
| **Available for active inference** | **~18.6 GB** |
| Dynamic overhead per user | ~3 GB |

### Simultaneous Users

| Metric | Value |
|--------|-------|
| Users processing at the exact same millisecond | **5–7** |
| Real-world concurrent users (with queuing) | **50–100** |
| Average translation latency (5–10 sec video) | **2–5 seconds** |

---

## 11. Future: Cloud Scaling

When local hosting is no longer sufficient:

| Component | Deploy To | Cost |
|-----------|-----------|------|
| Frontend (Next.js) | Vercel / Netlify | Free |
| Backend (FastAPI + models) | RunPod Serverless / Modal.com | Pay-per-second GPU usage |

The key advantage of the Client-Server architecture is that **zero code changes** are needed to move from local to cloud. You only change the `NEXT_PUBLIC_API_URL` environment variable in the frontend from `http://localhost:8000` to the cloud endpoint URL.

---

## Developer Delegation Summary

| Role | Scope | Key Files |
|------|-------|-----------|
| **ML Engineer (you)** | Train TRSL/PSL checkpoints, maintain inference pipeline | `trsl/`, `psl/`, `features.py`, `inference.py` |
| **Backend Developer** | Build `api.py`, add queueing, handle file uploads | `api.py`, `requirements_api.txt` |
| **Frontend Developer** | Build the Next.js chat UI, webcam recorder, avatar player | `sign-language-ui/` (entire folder) |
