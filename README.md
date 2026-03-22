# Concept Strip Studio

Minimal web MVP for turning hard AI concepts into clear, engaging office-strip explainers.

## What it does

- Accepts free-text concepts and suggestion chips.
- Infers concept complexity and scales comic length from 1 to 8 panels.
- Uses a fixed original cast for recurring comic continuity.
- Generates panel art with Gemini image generation.
- Overlays the exact script text in the browser for more reliable readability.
- Saves rendered strips locally in browser storage.
- Exports shareable PNG files.

## Setup

1. Copy [.env.example](/Users/faisalshariff/Documents/New project/comic-app/.env.example) to `.env`.
2. Add your Gemini API key to `GEMINI_API_KEY`.
3. Start the app:

```bash
npm start
```

4. Open `http://127.0.0.1:3000`.

Do not open [public/index.html](/Users/faisalshariff/Documents/New project/comic-app/public/index.html) directly with `file://`. The generation flow depends on the local server and browser security will block it.

## Notes

- Default text model: `gemini-2.5-flash`
- Default image model: `gemini-3.1-flash-image-preview`
- Anatomy QA pass is enabled by default and can auto-regenerate panel images if duplicated limbs/body parts are detected.
- Tuning knobs:
  - `ENABLE_ANATOMY_VALIDATION=1|0`
  - `MAX_PANEL_IMAGE_ATTEMPTS=1..5`
- Saved comics are local to the current browser only.
- Because the API key was shared in chat, rotating it before real use is the safer choice.
