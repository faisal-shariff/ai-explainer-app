# AI Explainer App

AI Explainer App turns difficult AI concepts into clear visual explainers with a recurring cast, structured panel flow, and export-ready PNG output.

This is a local MVP built as a small web app. You enter a concept like `transformers`, `fine-tuning`, or `mixture of experts`, and the app generates a multi-panel visual walkthrough designed to make the idea easier to understand.

## What It Does

- Accepts custom concepts or suggested topics.
- Infers complexity and adjusts panel count automatically.
- Generates a consistent recurring cast for continuity across explainers.
- Produces panel artwork with Gemini image generation.
- Overlays dialogue in the app for readability and layout control.
- Saves explainers locally in the browser.
- Exports a clean PNG in one click.

## MVP Scope

Current MVP includes:

- Local-only usage
- Browser-based save library
- PNG export
- Guide cast continuity
- Speech-bubble and panel layout logic
- Anatomy and continuity validation with regeneration retries

## Tech Stack

- Node.js server
- Plain HTML, CSS, and JavaScript frontend
- Gemini text + image APIs

## Local Setup

1. Go to the project folder:

```bash
cd '/Users/faisalshariff/Documents/New project/comic-app'
```

2. Copy the env template:

```bash
cp .env.example .env
```

3. Add your Gemini API key to `.env`:

```bash
GEMINI_API_KEY=your_key_here
```

4. Start the app:

```bash
npm start
```

5. Open:

```text
http://127.0.0.1:3000
```

## Important

Do not open `public/index.html` directly with `file://`. The app must run through the local server.

## Environment Notes

- Default text model: `gemini-2.5-flash`
- Default image model: `gemini-3.1-flash-image-preview`
- Validation retries can be tuned with:
  - `ENABLE_ANATOMY_VALIDATION=1|0`
  - `MAX_PANEL_IMAGE_ATTEMPTS=1..5`

## Repo Contents

- `server.js` - API server and generation pipeline
- `public/index.html` - page structure
- `public/styles.css` - visual design and layout
- `public/app.js` - frontend interaction logic

## Current Status

This repo is set up and pushed on `main`. It is ready for continued iteration and deployment work.
