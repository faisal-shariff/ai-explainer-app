import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const env = loadEnv(path.join(__dirname, ".env"));

const PORT = Number(env.PORT || 3000);
const HOST = env.HOST || "127.0.0.1";
const GEMINI_API_KEY = env.GEMINI_API_KEY || "";
const TEXT_MODEL_CANDIDATES = uniqueModels(
  env.GEMINI_TEXT_MODEL,
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-pro-latest",
  "gemini-3.1-pro-preview"
);
const IMAGE_MODEL_CANDIDATES = uniqueModels(
  env.GEMINI_IMAGE_MODEL,
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview"
);
const TEXT_MODEL = pickPreferredModel(TEXT_MODEL_CANDIDATES, [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-pro-latest"
]);
const IMAGE_MODEL = pickPreferredModel(IMAGE_MODEL_CANDIDATES, [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview"
]);
const ENABLE_ANATOMY_VALIDATION = env.ENABLE_ANATOMY_VALIDATION !== "0";
const ENABLE_CONTINUITY_VALIDATION = env.ENABLE_CONTINUITY_VALIDATION !== "0";
const MAX_PANEL_IMAGE_ATTEMPTS = clamp(Number(env.MAX_PANEL_IMAGE_ATTEMPTS) || 2, 1, 6);
const GEMINI_REQUEST_TIMEOUT_MS = clamp(Number(env.GEMINI_REQUEST_TIMEOUT_MS) || 35000, 5000, 120000);
const CAST_PHOTO_ASPECT_RATIO = "16:9";
const CAST_PHOTO_SIZE = "1K";

const CHARACTER_ROSTER = [
  {
    name: "Mira",
    role: "machine learning engineer",
    personality: "precise, dry, patient when explaining tricky ideas",
    look: "straight black bob, coral blazer, white blouse, charcoal trousers, black heels, silver tablet with charts"
  },
  {
    name: "Len",
    role: "product manager",
    personality: "curious, jargon-prone, accidentally asks perfect beginner questions",
    look: "clean-shaven man, messy brown hair, white rolled-sleeve shirt, teal tie, charcoal trousers, brown shoes, roadmap printouts"
  },
  {
    name: "Dot",
    role: "data analyst",
    personality: "skeptical, practical, always asks how the numbers were measured",
    look: "round glasses, mustard cardigan, cream blouse, dark skirt or trousers, sticker-covered analytics laptop"
  },
  {
    name: "Byte",
    role: "office automation bot",
    personality: "literal, earnest, occasionally brings light wit by taking metaphors too literally",
    look: "small grey wheeled office robot, cyan display face, compact arms, badge lanyard, no human features"
  }
];

const EXPLANATION_MODE_PROFILES = {
  quick: {
    key: "quick",
    label: "Quick explainer",
    promptStyle: "Prioritize a fast, high-signal explanation with minimal jargon and compact dialogue.",
    depthRule: "Favor intuitive analogies and practical meaning over low-level detail.",
    miraMinWords: 8,
    miraMaxWords: 13,
    otherMaxWords: 9
  },
  clear: {
    key: "clear",
    label: "Clear explainer",
    promptStyle: "Balance clarity and mechanism detail in plain language.",
    depthRule: "Keep explanations accurate and easy to follow for mixed experience levels.",
    miraMinWords: 10,
    miraMaxWords: 16,
    otherMaxWords: 11
  },
  detailed: {
    key: "detailed",
    label: "Detailed explainer",
    promptStyle: "Increase mechanism depth and include richer, concrete detail without becoming verbose.",
    depthRule: "Use precise terminology where helpful and build understanding step by step.",
    miraMinWords: 12,
    miraMaxWords: 19,
    otherMaxWords: 13
  },
  technical: {
    key: "technical",
    label: "Technical explainer",
    promptStyle: "Use technical precision, include system behavior and tradeoffs, and reduce metaphor reliance.",
    depthRule: "Assume the user can handle domain terms when they improve correctness.",
    miraMinWords: 12,
    miraMaxWords: 18,
    otherMaxWords: 13
  }
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

let castPhotoCache = null;
let castPhotoLastError = "";
let castReferenceCache = null;
let castReferenceLastError = "";
let activeTextModel = TEXT_MODEL;
let activeImageModel = IMAGE_MODEL;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        hasApiKey: Boolean(GEMINI_API_KEY),
        textModel: activeTextModel,
        imageModel: activeImageModel
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      if (!GEMINI_API_KEY) {
        sendJson(res, 400, {
          error: "Missing GEMINI_API_KEY. Add it to comic-app/.env before generating."
        });
        return;
      }

      const body = await readJsonBody(req);
      const concept = typeof body.concept === "string" ? body.concept.trim() : "";
      const explanationMode = normalizeExplanationMode(
        typeof body.explanationMode === "string"
          ? body.explanationMode
          : typeof body.audience === "string"
            ? body.audience
            : "clear"
      );

      if (!concept) {
        sendJson(res, 400, { error: "Concept is required." });
        return;
      }

      const comic = await buildComic(concept, explanationMode);
      sendJson(res, 200, { comic });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/cast-photo") {
      const forceRefresh = url.searchParams.get("refresh") === "1";
      const castPhoto = await getCastPhoto({ forceRefresh });
      sendJson(res, 200, castPhoto);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method Not Allowed");
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, {
      error: error.message || "Unexpected server error."
    });
  }
});

if (env.NO_LISTEN !== "1") {
  server.listen(PORT, HOST, () => {
    console.log(`Concept Clarity listening on http://${HOST}:${PORT}`);
  });
}

async function buildComic(concept, explanationMode) {
  const modeProfile = getExplanationModeProfile(explanationMode);
  const script = await generateComicScript(concept, explanationMode);
  const castReference = await getCanonicalCastReference();
  const castReferenceImageDataUrl = castReference.imageDataUrl;
  const panels = [];
  const fallbackPanels = [];

  for (let index = 0; index < script.panels.length; index += 1) {
    const panel = script.panels[index];
    const panelGeneration = await generatePanelImageWithValidation(script, panel, index, {
      castReferenceImageDataUrl,
      previousPanelImageDataUrl: panels[index - 1]?.imageDataUrl || ""
    });

    if (panelGeneration.meta.usedFallback) {
      fallbackPanels.push({
        panelNumber: panel.panelNumber || index + 1,
        attempts: panelGeneration.meta.attempts,
        failureTypes: panelGeneration.meta.failureTypes,
        reason: panelGeneration.meta.reason
      });
    }

    panels.push({
      ...panel,
      imageDataUrl: panelGeneration.imageDataUrl,
      generation: panelGeneration.meta
    });
  }

  const fallbackCount = fallbackPanels.length;

  return {
    ...script,
    panels,
    generationSummary: {
      fallbackPanelCount: fallbackCount,
      fallbackPanels,
      message: fallbackCount
        ? `${fallbackCount} panel${fallbackCount === 1 ? "" : "s"} used reliability fallback output after retries.`
        : ""
    },
    characterRoster: CHARACTER_ROSTER,
    castReferenceImageDataUrl,
    concept,
    explanationMode,
    modeLabel: modeProfile.label,
    audience: explanationMode,
    audienceLabel: modeProfile.label,
    generatedAt: new Date().toISOString()
  };
}

export { buildComic, server };

async function getCastPhoto({ forceRefresh = false } = {}) {
  if (!forceRefresh && castPhotoCache) {
    return castPhotoCache;
  }

  let imageDataUrl = "";
  let source = "gemini";
  const castReference = await getCanonicalCastReference({ forceRefresh });

  if (GEMINI_API_KEY) {
    try {
      imageDataUrl = await generateCastGroupPhoto({
        castReferenceImageDataUrl: castReference.imageDataUrl
      });
      castPhotoLastError = "";
    } catch (error) {
      imageDataUrl = "";
      castPhotoLastError = error?.message || "Unknown cast photo generation error.";
    }
  } else {
    castPhotoLastError = "Missing GEMINI_API_KEY.";
  }

  if (!imageDataUrl) {
    imageDataUrl = castReference.imageDataUrl;
    source = castReference.source === "fallback" ? "fallback" : "reference";
  }

  castPhotoCache = {
    ok: true,
    imageDataUrl,
    referenceImageDataUrl: castReference.imageDataUrl,
    source,
    reason: source === "fallback" ? castPhotoLastError : "",
    generatedAt: new Date().toISOString()
  };

  return castPhotoCache;
}

async function getCanonicalCastReference({ forceRefresh = false } = {}) {
  if (!forceRefresh && castReferenceCache) {
    return castReferenceCache;
  }
  let imageDataUrl = "";
  let source = "gemini";

  if (GEMINI_API_KEY) {
    try {
      imageDataUrl = await generateCanonicalCastReferenceImage();
      castReferenceLastError = "";
    } catch (error) {
      imageDataUrl = "";
      castReferenceLastError = error?.message || "Unknown cast reference generation error.";
    }
  } else {
    castReferenceLastError = "Missing GEMINI_API_KEY.";
  }

  if (!imageDataUrl) {
    imageDataUrl = buildCastPhotoFallbackSvgDataUrl();
    source = "fallback";
  }

  castReferenceCache = {
    ok: true,
    imageDataUrl,
    source,
    reason: source === "fallback" ? castReferenceLastError : "",
    generatedAt: new Date().toISOString()
  };

  return castReferenceCache;
}

async function fetchWithTimeout(url, options, timeoutMs = GEMINI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateComicScript(concept, explanationMode) {
  const modeProfile = getExplanationModeProfile(explanationMode);
  const simpleRange = getPanelRange("simple", explanationMode);
  const mediumRange = getPanelRange("medium", explanationMode);
  const advancedRange = getPanelRange("advanced", explanationMode);

  const prompt = [
    "You write accurate, engaging visual explainers about AI concepts.",
    "Create an ORIGINAL illustrated sequence inspired by workplace satire, without copying Dilbert or any existing copyrighted characters.",
    `Explanation mode: ${modeProfile.label} (${modeProfile.key}). ${modeProfile.promptStyle}`,
    `Depth guidance: ${modeProfile.depthRule}`,
    "Prioritize factual correctness, clarity, and insight over humor.",
    "Use light workplace wit only when it helps the explanation land. Do not force punchlines.",
    "Infer complexity from the concept and choose panel count with this strict rubric for this mode:",
    `- simple: ${formatRange(simpleRange)} panels`,
    `- medium: ${formatRange(mediumRange)} panels`,
    `- advanced: ${formatRange(advancedRange)} panels`,
    "Use this recurring cast when relevant:",
    ...CHARACTER_ROSTER.map((character) => `- ${character.name}: ${character.role}; ${character.personality}; ${character.look}`),
    `Concept to explain: ${concept}`,
    "Narrative structure:",
    "- Start with a realistic misunderstanding or question.",
    "- Show why the naive interpretation fails.",
    "- Reframe the concept in plain language.",
    "- Show the mechanism or practical behavior.",
    "- Show a practical example or consequence.",
    "- End with a memorable, correct takeaway.",
    "Return JSON only with this shape:",
    JSON.stringify(
      {
        title: "Short punchy title",
        hook: "One-sentence premise",
        summary: "Two-sentence explanation in plain English",
        modeLabel: "short user-facing label for explanation mode",
        complexity: "simple | medium | advanced",
        panelCount: 5,
        shareCaption: "One short line people would want to share",
        takeaways: ["up to 4 clear bullets"],
        learning: {
          whatItIs: "1-2 sentence plain explanation",
          commonConfusion: "one sentence about the typical misunderstanding",
          whenToUseIt: "one sentence on when it matters in practice"
        },
        panels: [
          {
            panelNumber: 1,
            setting: "office location",
            visual: "what the art should depict",
            caption: "very short caption, optional but usually useful",
            purpose: "misunderstanding | failure | reframing | mechanism | application | takeaway",
            characters: ["Mira", "Len"],
            staging: {
              left: "Len",
              center: "",
              right: "Mira"
            },
            dialogue: [
              { speaker: "Len", line: "short setup question under 10 words" },
              { speaker: "Mira", line: "clear response with one mechanism detail, 10-16 words" }
            ]
          }
        ]
      },
      null,
      2
    ),
    "Constraints:",
    "- Keep dialogue concise and readable inside each panel.",
    "- Use at most 2 dialogue lines per panel.",
    "- Use 2 to 3 characters per panel max.",
    `- Keep non-expert/question lines short (usually ${modeProfile.otherMaxWords} words or fewer).`,
    `- When Mira speaks, include one concrete mechanism detail in ${modeProfile.miraMinWords} to ${modeProfile.miraMaxWords} words.`,
    "- Prefer Mira as dialogue line 2 when present, so line 1 sets up and line 2 clarifies.",
    "- In two-line panels, line 1 is setup/question and line 2 is response/clarification.",
    "- Avoid trailing ellipses unless a sentence is intentionally interrupted.",
    "- Captions should be 6 words or fewer.",
    "- Let the characters carry the explanation naturally through their reactions and questions.",
    "- The explanation must stand on its own even if the wit is subtle.",
    "- Each panel should teach one distinct idea.",
    "- For each panel, include a staging map with expected character placement: left/center/right.",
    "- The speaker of dialogue line 1 must be staged on the left; line 2 should be staged on the right when possible.",
    "- Most concepts should unfold over at least five beats so the explanation does not feel rushed.",
    "- Ensure the final panel lands on understanding, not on a punchline."
  ].join("\n");

  const response = await callGeminiText({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7
    }
  });

  const rawText = getTextResponse(response);
  const parsed = safeJsonParse(rawText);

  if (!parsed) {
    throw createHttpError(502, "Gemini returned malformed comic JSON.");
  }

  return normalizeComic(parsed, concept, explanationMode);
}

async function generateCanonicalCastReferenceImage() {
  const prompt = [
    "Create a clean character reference sheet with exactly four full-body characters on a neutral studio background.",
    "No text, labels, logos, or speech bubbles.",
    "Use flat-color office comic style with crisp outlines.",
    "This sheet is the canonical identity bible for all generated panels and homepage cast visuals.",
    "Facial structure, hairstyle, clothing colors, accessories, and body proportions must be unmistakable and stable.",
    "Use one camera angle and clean upright poses so identity is easy to match later.",
    "Characters to depict side-by-side in this exact order:",
    ...CHARACTER_ROSTER.map((character) => `- ${character.name}: ${character.look}; personality hint: ${character.personality}`)
  ].join("\n");

  const response = await callGeminiImage({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K"
      }
    }
  });

  const imagePart = getInlineImagePart(response);
  if (!imagePart) {
    throw createHttpError(502, "Gemini did not return a cast reference image.");
  }

  return `data:${imagePart.mimeType};base64,${imagePart.data}`;
}

async function generateCastGroupPhoto({ castReferenceImageDataUrl = "" } = {}) {
  const prompt = [
    "Create a single original flat-color office comic style group photo.",
    "Reference image 1 is the canonical cast identity bible. Match those exact faces, hair, outfits, accessories, and body proportions.",
    "Do not redesign, restyle, or recolor any character.",
    "Show exactly these four recurring characters in one coherent frame in a modern office:",
    ...CHARACTER_ROSTER.map((character) => `- ${character.name}: ${character.look}; role vibe: ${character.role}`),
    "No speech bubbles, no captions, no labels, no logos, and no watermarks.",
    "Strict anatomy for humans: exactly two arms and two legs per person, no extra limbs or duplicated body parts.",
    "All faces must be clear and friendly, with natural poses.",
    "Keep color palette clean and professional."
  ].join("\n");

  const parts = [{ text: prompt }];
  if (castReferenceImageDataUrl) {
    parts.push({ inlineData: dataUrlToInlineData(castReferenceImageDataUrl) });
  }

  const response = await callGeminiImage({
    contents: [{ parts }],
    generationConfig: {
      imageConfig: {
        aspectRatio: CAST_PHOTO_ASPECT_RATIO,
        imageSize: CAST_PHOTO_SIZE
      }
    }
  });

  const imagePart = getInlineImagePart(response);
  if (!imagePart) {
    throw createHttpError(502, "Gemini did not return a cast group photo.");
  }

  return `data:${imagePart.mimeType};base64,${imagePart.data}`;
}

async function generatePanelImage(script, panel, index, references) {
  const visibleCharacters = panel.characters
    .map((name) => CHARACTER_ROSTER.find((character) => character.name === name))
    .filter(Boolean);
  const expectedCharacterCount = Array.isArray(panel.characters)
    ? panel.characters.filter(Boolean).length
    : 0;
  const isStrictRetry = Number(references?.retryContext?.attempt || 1) > 1;

  const prompt = [
    "Create a single comic panel illustration in an ORIGINAL flat-color office satire style.",
    "The vibe can be newspaper-office satire, but it must not copy Dilbert or mimic Scott Adams line-for-line or visually.",
    "Use crisp ink outlines, clean shapes, expressive faces, a muted office palette, and a professional but playful tone.",
    "Anatomy constraints are strict for human characters:",
    "- exactly one head and one torso per person",
    "- exactly two arms, two hands, two legs, and two feet per person",
    "- no duplicated limbs, fused limbs, floating hands, extra fingers, or broken joints",
    "- avoid ambiguous overlapping limbs that can read as extra arms",
    "- keep clear negative space between people so limb ownership is unambiguous",
    "- avoid arm/hand overlap across different characters",
    "- use simple, natural poses over dramatic gestures",
    "Do not include any text, letters, speech bubbles, captions, logos, watermarks, signatures, or interface chrome.",
    "Leave the upper 28% of the frame visually clear for bubble overlays.",
    "Keep heads and bodies mostly in the lower 72% of the frame.",
    "Character continuity rules are strict across panels in this strip.",
    "Reference image 1 is the canonical cast identity bible. Match it exactly.",
    "Do not change face shape, hairstyle, outfit palette, accessories, or body proportions for named characters.",
    "If a named character appears again, keep the exact same face shape, age range, hair, outfit colors, silhouette, and accessories.",
    "Do not redesign or restyle recurring characters between panels.",
    "Mira must always be the same early-30s woman with a straight black bob, coral blazer, white blouse, charcoal trousers, black heels, and silver tablet.",
    "Len must always be the same early-30s clean-shaven man, with no beard or mustache, messy brown hair, white rolled-sleeve shirt, teal tie, charcoal trousers, and brown shoes.",
    "Dot must always be the same woman with round glasses, mustard cardigan, cream blouse, and analytics laptop.",
    "Byte must always be the same small grey wheeled robot with a cyan face-screen and badge lanyard.",
    "Keep character height and build roughly consistent across panels.",
    `This is panel ${index + 1} of ${script.panelCount}.`,
    `Comic title: ${script.title}.`,
    `Overall concept: ${script.summary}.`,
    `Panel purpose in the teaching arc: ${panel.purpose}.`,
    `Character staging for this panel: left=${panel.staging?.left || "none"}, center=${panel.staging?.center || "none"}, right=${panel.staging?.right || "none"}.`,
    "Follow staging strictly unless a slot is marked none.",
    `Setting: ${panel.setting}.`,
    `Scene action: ${panel.visual}.`,
    visibleCharacters.length
      ? `Characters in frame: ${visibleCharacters
          .map(
            (character) =>
              `${character.name} (${character.role}; ${character.look}; ${character.personality})`
          )
          .join("; ")}.`
      : "Characters in frame: use original office workers matching the series look.",
    "Use provided reference images as hard continuity anchors:",
    "- Reference image 1: cast reference sheet for identity and outfit consistency.",
    "- Reference image 2: previous panel, for continuity of look and palette.",
    "- Reference image 3 (if provided): prior failed attempt; fix listed anatomy/continuity issues.",
    references?.correctionNotes
      ? `Critical fixes from previous attempt: ${references.correctionNotes}. Apply these fixes before returning image.`
      : "No prior anatomy or continuity corrections provided.",
    isStrictRetry
      ? `STRICT RETRY MODE (attempt ${references.retryContext.attempt} of ${references.retryContext.maxAttempts}): previous failure type ${references.retryContext.failureType}.`
      : "",
    isStrictRetry && expectedCharacterCount > 0
      ? `Render exactly ${expectedCharacterCount} characters in frame and no extra people or background silhouettes.`
      : "",
    isStrictRetry
      ? "Do not add extra limbs, duplicated body parts, or duplicate characters under any circumstances."
      : "",
    isStrictRetry
      ? "For each human: one head, one torso, exactly two arms, two hands, two legs, and two feet."
      : "",
    isStrictRetry
      ? "Preserve canonical character appearance and continuity: same face shape, hairstyle, clothing colors, and accessories."
      : "",
    isStrictRetry
      ? "Preserve continuity with previous panel and cast reference; no redesigns, swaps, or extra people."
      : "",
    "Frame the composition so it reads clearly as a standalone comic panel."
  ]
    .filter(Boolean)
    .join("\n");

  const parts = [{ text: prompt }];
  if (references?.castReferenceImageDataUrl) {
    parts.push({ inlineData: dataUrlToInlineData(references.castReferenceImageDataUrl) });
  }
  if (references?.previousPanelImageDataUrl) {
    parts.push({ inlineData: dataUrlToInlineData(references.previousPanelImageDataUrl) });
  }
  if (references?.previousAttemptImageDataUrl) {
    parts.push({ inlineData: dataUrlToInlineData(references.previousAttemptImageDataUrl) });
  }

  const response = await callGeminiImage({
    contents: [{ parts }],
    generationConfig: {
      imageConfig: {
        aspectRatio: "4:3",
        imageSize: "1K"
      }
    }
  });

  const imagePart = getInlineImagePart(response);

  if (!imagePart) {
    throw createHttpError(502, `Gemini did not return an image for panel ${index + 1}.`);
  }

  return `data:${imagePart.mimeType};base64,${imagePart.data}`;
}

async function generatePanelImageWithValidation(script, panel, index, references) {
  let bestEffortImageDataUrl = "";
  let previousAttemptImageDataUrl = "";
  let correctionNotes = "";
  let lastFailureType = "render";
  let lastFailureReason = "";
  const failureTypes = new Set();
  const failureNotes = [];
  let lastAudit = {
    anatomy: { pass: true, issues: [] },
    continuity: { pass: true, issues: [] }
  };

  // Retry only this panel; never restart the full strip when one panel fails validation.
  for (let attempt = 1; attempt <= MAX_PANEL_IMAGE_ATTEMPTS; attempt += 1) {
    let imageDataUrl = "";
    try {
      imageDataUrl = await generatePanelImage(script, panel, index, {
        ...references,
        correctionNotes,
        previousAttemptImageDataUrl,
        retryContext: {
          attempt,
          maxAttempts: MAX_PANEL_IMAGE_ATTEMPTS,
          failureType: lastFailureType
        }
      });
      bestEffortImageDataUrl = imageDataUrl;
    } catch (error) {
      failureTypes.add("render");
      lastFailureType = "render";
      lastFailureReason = normalizeText(
        error?.message,
        `Panel ${index + 1} image generation request failed.`
      );
      failureNotes.push(`render: ${lastFailureReason}`);
      correctionNotes = buildRetryCorrectionNotes(
        panel,
        index,
        attempt,
        MAX_PANEL_IMAGE_ATTEMPTS,
        failureNotes
      );
      continue;
    }

    const requiresHumanAnatomyCheck = Array.isArray(panel?.characters)
      ? panel.characters.some((name) => name && name !== "Byte")
      : false;
    const shouldRunAnatomyValidation = ENABLE_ANATOMY_VALIDATION && requiresHumanAnatomyCheck;
    const shouldRunContinuityValidation = ENABLE_CONTINUITY_VALIDATION && index > 0;

    if (!shouldRunAnatomyValidation && !shouldRunContinuityValidation) {
      return {
        imageDataUrl,
        meta: {
          attempts: attempt,
          usedFallback: false,
          failureTypes: [],
          reason: ""
        }
      };
    }

    const [anatomyAudit, continuityAudit] = await Promise.all([
      shouldRunAnatomyValidation
        ? auditPanelAnatomy(imageDataUrl, panel, script, index)
        : Promise.resolve({ pass: true, issues: [] }),
      shouldRunContinuityValidation
        ? auditPanelContinuity(imageDataUrl, panel, script, index, references)
        : Promise.resolve({ pass: true, issues: [] })
    ]);

    lastAudit = {
      anatomy: anatomyAudit,
      continuity: continuityAudit
    };

    if (anatomyAudit.pass && continuityAudit.pass) {
      return {
        imageDataUrl,
        meta: {
          attempts: attempt,
          usedFallback: false,
          failureTypes: [],
          reason: ""
        }
      };
    }

    const issueNotes = [];
    if (!anatomyAudit.pass) {
      failureTypes.add("anatomy");
      issueNotes.push(...anatomyAudit.issues.map((issue) => `anatomy: ${issue}`));
    }
    if (!continuityAudit.pass) {
      failureTypes.add("continuity");
      issueNotes.push(...continuityAudit.issues.map((issue) => `continuity: ${issue}`));
    }

    lastFailureType = classifyFailureType(anatomyAudit, continuityAudit);
    lastFailureReason = issueNotes[0] || "Validation mismatch";
    failureNotes.push(...issueNotes);
    correctionNotes = buildRetryCorrectionNotes(
      panel,
      index,
      attempt,
      MAX_PANEL_IMAGE_ATTEMPTS,
      failureNotes
    );
    previousAttemptImageDataUrl = imageDataUrl;
  }

  const lastIssues = [
    ...lastAudit.anatomy.issues.map((issue) => `anatomy: ${issue}`),
    ...lastAudit.continuity.issues.map((issue) => `continuity: ${issue}`)
  ]
    .filter(Boolean)
    .join("; ");

  const reason = lastFailureReason || lastIssues || `Panel ${index + 1} failed validation after retries.`;
  // If we have any rendered image, keep the best effort so the explainer can still complete.
  if (bestEffortImageDataUrl) {
    return {
      imageDataUrl: bestEffortImageDataUrl,
      meta: {
        attempts: MAX_PANEL_IMAGE_ATTEMPTS,
        usedFallback: true,
        failureTypes: [...failureTypes],
        reason
      }
    };
  }

  return {
    imageDataUrl: buildPanelFallbackSvgDataUrl(panel, index, reason),
    meta: {
      attempts: MAX_PANEL_IMAGE_ATTEMPTS,
      usedFallback: true,
      failureTypes: [...failureTypes, "render"],
      reason
    }
  };
}

function classifyFailureType(anatomyAudit, continuityAudit) {
  if (!anatomyAudit.pass && !continuityAudit.pass) {
    return "anatomy+continuity";
  }
  if (!anatomyAudit.pass) {
    return "anatomy";
  }
  if (!continuityAudit.pass) {
    return "continuity";
  }
  return "render";
}

function buildRetryCorrectionNotes(panel, index, attempt, maxAttempts, failureNotes) {
  const expectedCharacterCount = Array.isArray(panel?.characters)
    ? panel.characters.filter(Boolean).length
    : 0;
  const recentNotes = failureNotes.slice(-6);

  return [
    `Retry panel ${index + 1}, attempt ${attempt} of ${maxAttempts}.`,
    recentNotes.length ? `Recent failures: ${recentNotes.join("; ")}` : "",
    expectedCharacterCount > 0
      ? `Render exactly ${expectedCharacterCount} named characters and no extra people.`
      : "Do not introduce background people or extra silhouettes.",
    "No extra limbs.",
    "No duplicated body parts.",
    "No extra people.",
    "Every human must have one head, one torso, two arms, two hands, two legs, and two feet.",
    "Preserve canonical character appearance from cast reference.",
    "Preserve clothing and accessory continuity from previous panel."
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPanelFallbackSvgDataUrl(panel, index, reason) {
  const escapedCaption = escapeSvgText(normalizeText(panel?.caption, "Recovered panel"));
  const escapedReason = escapeSvgText(normalizeText(reason, "Panel recovery fallback"));
  const escapedIndex = escapeSvgText(`Panel ${index + 1}`);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f9f3e8"/>
      <stop offset="100%" stop-color="#eef4f7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <rect x="74" y="70" width="1052" height="760" rx="26" fill="#ffffff" stroke="#d7e2ec" stroke-width="4"/>
  <text x="120" y="170" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#173452">${escapedIndex}</text>
  <text x="120" y="248" font-family="Arial, sans-serif" font-size="36" fill="#1f3c5a">${escapedCaption}</text>
  <text x="120" y="318" font-family="Arial, sans-serif" font-size="24" fill="#4a5f76">Recovered fallback visual used to keep the explainer complete.</text>
  <text x="120" y="380" font-family="Arial, sans-serif" font-size="21" fill="#6b7f94">${escapedReason}</text>
  <rect x="120" y="430" width="960" height="320" rx="18" fill="#f4f8fc" stroke="#d5e1ed" stroke-width="3"/>
  <text x="600" y="595" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#2a4664">Panel regenerated with reliability fallback</text>
</svg>`;

  const encoded = Buffer.from(svg.replace(/\n+/g, "").trim()).toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function callGeminiText(body) {
  const { model, json } = await callGeminiWithFallback({
    model: activeTextModel,
    fallbackModels: TEXT_MODEL_CANDIDATES,
    body
  });
  activeTextModel = model;
  return json;
}

async function callGeminiImage(body) {
  const { model, json } = await callGeminiWithFallback({
    model: activeImageModel,
    fallbackModels: IMAGE_MODEL_CANDIDATES,
    body
  });
  activeImageModel = model;
  return json;
}

async function callGeminiWithFallback({ model, fallbackModels, body }) {
  const candidates = uniqueModels(model, ...(Array.isArray(fallbackModels) ? fallbackModels : []));
  let lastFailure = null;

  for (const candidate of candidates) {
    let response;
    try {
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
          },
          body: JSON.stringify(body)
        }
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        lastFailure = {
          status: 504,
          model: candidate,
          details: `Request timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms`
        };
        continue;
      }
      throw createHttpError(502, `Gemini request failed on model ${candidate}: ${error?.message || "fetch failed"}`);
    }

    if (response.ok) {
      return {
        model: candidate,
        json: await response.json()
      };
    }

    const details = await response.text();
    const compactDetails = details.slice(0, 400);
    if (!isUnavailableModelError(response.status, compactDetails)) {
      throw createHttpError(
        response.status,
        `Gemini request failed (${response.status}) on model ${candidate}: ${compactDetails}`
      );
    }

    lastFailure = { status: response.status, model: candidate, details: compactDetails };
  }

  const summary = lastFailure
    ? `Last tried model ${lastFailure.model} (${lastFailure.status}): ${lastFailure.details}`
    : "No candidate models available.";
  throw createHttpError(502, `Gemini model fallback exhausted. ${summary}`);
}

function isUnavailableModelError(status, details = "") {
  if (status !== 404 && status !== 400) {
    return false;
  }

  const text = String(details).toLowerCase();
  return (
    text.includes("not found") ||
    text.includes("not supported") ||
    text.includes("available models") ||
    (text.includes("model") && text.includes("invalid"))
  );
}

function normalizeComic(raw, concept, explanationMode) {
  const modeProfile = getExplanationModeProfile(explanationMode);
  const fallbackComplexity = "medium";
  const normalizedComplexity = ["simple", "medium", "advanced"].includes(raw.complexity)
    ? raw.complexity
    : fallbackComplexity;
  const panelRange = getPanelRange(normalizedComplexity, explanationMode);
  const rawPanels = Array.isArray(raw.panels) ? raw.panels : [];
  const boundedPanelCount = clamp(Number(raw.panelCount) || rawPanels.length || panelRange.min, panelRange.min, panelRange.max);
  const panels = rawPanels
    .slice(0, boundedPanelCount)
    .map((panel, index) => normalizePanel(panel, index + 1, explanationMode));

  while (panels.length < boundedPanelCount) {
    const fallbackPurpose =
      panels.length === 0
        ? "misunderstanding"
        : panels.length === 1
          ? "failure"
          : panels.length === 2
            ? "reframing"
            : panels.length === boundedPanelCount - 1
              ? "takeaway"
              : panels.length === boundedPanelCount - 2
                ? "application"
                : "mechanism";

    panels.push({
      panelNumber: panels.length + 1,
      setting: "open-plan office",
      visual: `Characters react to the concept ${concept} in a workplace scene.`,
      caption: panels.length === boundedPanelCount - 1 ? "So that is the point." : "Still unpacking this.",
      purpose: fallbackPurpose,
      characters: ["Mira", "Len"],
      staging: {
        left: "Len",
        center: "",
        right: "Mira"
      },
      dialogue: [
        {
          speaker: "Len",
          line: "I think I get it. Do I really?"
        },
        {
          speaker: "Mira",
          line: "Almost. Here is the practical version."
        }
      ]
    });
  }

  return {
    title: normalizeText(raw.title, "AI Explained By The Office"),
    hook: normalizeText(raw.hook, "A workplace tries to understand an AI idea without drowning in jargon."),
    summary: normalizeText(
      raw.summary,
      `This visual explainer covers ${concept} with a clear workplace analogy and an accurate takeaway.`
    ),
    modeLabel: normalizeText(raw.modeLabel, modeProfile.label),
    explanationMode,
    audience: explanationMode,
    audienceLabel: normalizeText(raw.audienceLabel, modeProfile.label),
    complexity: normalizedComplexity,
    panelCount: boundedPanelCount,
    shareCaption: normalizeText(raw.shareCaption, `A clear visual breakdown of ${concept} for your team.`),
    takeaways: normalizeStringArray(raw.takeaways, 4, [
      `This visual brief simplifies ${concept} without dropping the core idea.`,
      "The workplace framing keeps the explanation concrete and easy to follow."
    ]),
    learning: normalizeLearning(raw.learning, concept),
    panels
  };
}

function normalizePanel(panel, panelNumber, explanationMode) {
  const characters = normalizeCharacters(panel.characters);
  const dialogue = Array.isArray(panel.dialogue)
    ? panel.dialogue
        .slice(0, 2)
        .map((line) => ({
          speaker: normalizeSpeaker(line?.speaker, characters[0] || "Mira"),
          line: normalizeText(line?.line, "Right, but what does that mean in practice?")
        }))
    : [];
  const finalDialogue = tuneDialogueForReadability(
    dialogue.length
      ? dialogue
    : [
        {
          speaker: characters[0] || "Mira",
          line: "Let me explain the part everyone pretends to understand."
        }
      ],
    normalizeText(panel?.purpose, panelNumber === 1 ? "misunderstanding" : "takeaway"),
    explanationMode
  );
  const baseStaging = normalizeStaging(panel.staging, characters);
  const alignedStaging = alignStagingWithDialogue(baseStaging, finalDialogue, characters);

  return {
    panelNumber,
    setting: normalizeText(panel.setting, "open-plan office"),
    visual: normalizeText(
      panel.visual,
      "An office team works through a confusing AI concept using whiteboards and charts."
    ),
    caption: normalizeText(panel.caption, "Office translation"),
    purpose: normalizeText(panel.purpose, panelNumber === 1 ? "misunderstanding" : "takeaway"),
    characters,
    staging: alignedStaging,
    dialogue: finalDialogue
  };
}

function normalizeStaging(staging, characters) {
  const valid = new Set(CHARACTER_ROSTER.map((character) => character.name));
  const fallback = {
    left: characters[0] || "Mira",
    center: characters[2] || "",
    right: characters[1] || "Len"
  };

  if (!staging || typeof staging !== "object") {
    return fallback;
  }

  const left = typeof staging.left === "string" && valid.has(staging.left) ? staging.left : fallback.left;
  const center = typeof staging.center === "string" && valid.has(staging.center) ? staging.center : "";
  const right = typeof staging.right === "string" && valid.has(staging.right) ? staging.right : fallback.right;

  // Ensure no duplicate slots so bubble ownership remains unambiguous.
  const used = new Set();
  const result = { left: "", center: "", right: "" };
  for (const [slot, value] of Object.entries({ left, center, right })) {
    if (value && !used.has(value)) {
      result[slot] = value;
      used.add(value);
    }
  }

  if (!result.left) {
    result.left = fallback.left;
  }
  if (!result.right || result.right === result.left) {
    result.right = fallback.right === result.left ? "" : fallback.right;
  }

  return result;
}

function tuneDialogueForReadability(dialogue, purpose, explanationMode) {
  const modeProfile = getExplanationModeProfile(explanationMode);
  const detailByPurpose = {
    misunderstanding: "It usually misses context, not raw data.",
    failure: "That fails when the task needs broader context.",
    reframing: "The key is relationships, not isolated words.",
    mechanism: "Attention scores decide which tokens matter most.",
    application: "That improves reliability on long, complex prompts.",
    takeaway: "Focus on mechanism, not buzzwords, when evaluating it."
  };

  return dialogue.slice(0, 2).map((line) => {
    const speaker = normalizeSpeaker(line?.speaker, "Mira");
    let text = normalizeText(line?.line, "Let me make that practical.");

    if (speaker === "Mira") {
      if (countWords(text) < modeProfile.miraMinWords) {
        const extra = detailByPurpose[purpose] || detailByPurpose.mechanism;
        text = `${stripTrailingPunctuation(text)} ${extra}`;
      }
      text = clampWords(text, modeProfile.miraMaxWords);
      return { speaker, line: text };
    }

    return { speaker, line: clampWords(text, modeProfile.otherMaxWords) };
  });
}

function alignStagingWithDialogue(staging, dialogue, characters) {
  const speakersInOrder = [...new Set((dialogue || []).map((line) => line?.speaker).filter(Boolean))];
  if (!speakersInOrder.length) {
    return staging;
  }

  const result = { ...staging };
  placeSpeakerInSlot(result, speakersInOrder[0], "left");

  if (speakersInOrder[1] && speakersInOrder[1] !== speakersInOrder[0]) {
    placeSpeakerInSlot(result, speakersInOrder[1], "right", ["left"]);
  }

  return normalizeStaging(result, characters);
}

function placeSpeakerInSlot(staging, speaker, targetSlot, lockedSlots = []) {
  if (!speaker || !targetSlot) {
    return;
  }

  const slots = ["left", "center", "right"];
  if (!slots.includes(targetSlot)) {
    return;
  }

  const currentSlot = slots.find((slot) => staging[slot] === speaker);
  if (currentSlot === targetSlot) {
    return;
  }

  const displaced = staging[targetSlot];
  if (currentSlot) {
    staging[currentSlot] = "";
  }
  staging[targetSlot] = speaker;

  if (!displaced || displaced === speaker) {
    return;
  }

  const preferredSlot = currentSlot && currentSlot !== targetSlot ? currentSlot : "";
  if (preferredSlot && !lockedSlots.includes(preferredSlot) && !staging[preferredSlot]) {
    staging[preferredSlot] = displaced;
    return;
  }

  const fallbackSlot = slots.find(
    (slot) => slot !== targetSlot && !lockedSlots.includes(slot) && !staging[slot]
  );
  if (fallbackSlot) {
    staging[fallbackSlot] = displaced;
  }
}

function normalizeLearning(learning, concept) {
  if (!learning || typeof learning !== "object") {
    return {
      whatItIs: `${concept} is explained here in plain language with an office analogy.`,
      commonConfusion: "People often confuse the buzzword with a broader category or outcome.",
      whenToUseIt: `Use this mental model when deciding how ${concept} actually works in practice.`
    };
  }

  return {
    whatItIs: normalizeText(
      learning.whatItIs,
      `${concept} is explained here in plain language with an office analogy.`
    ),
    commonConfusion: normalizeText(
      learning.commonConfusion,
      "People often confuse the buzzword with a broader category or outcome."
    ),
    whenToUseIt: normalizeText(
      learning.whenToUseIt,
      `Use this mental model when deciding how ${concept} actually works in practice.`
    )
  };
}

function normalizeCharacters(characters) {
  const rosterNames = new Set(CHARACTER_ROSTER.map((character) => character.name));
  const cleaned = Array.isArray(characters)
    ? characters.filter((name) => typeof name === "string" && rosterNames.has(name))
    : [];

  return cleaned.length ? cleaned.slice(0, 3) : ["Mira", "Len"];
}

function normalizeSpeaker(name, fallback) {
  const validNames = new Set(CHARACTER_ROSTER.map((character) => character.name));
  return validNames.has(name) ? name : fallback;
}

function normalizeStringArray(value, maxLength, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxLength);

  return cleaned.length ? cleaned : fallback;
}

function normalizeText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function getPanelRange(complexity, explanationMode = "clear") {
  const mode = normalizeExplanationMode(explanationMode);

  if (mode === "quick") {
    if (complexity === "simple") {
      return { min: 3, max: 4 };
    }
    if (complexity === "advanced") {
      return { min: 5, max: 6 };
    }
    return { min: 4, max: 5 };
  }

  if (mode === "detailed" || mode === "technical") {
    if (complexity === "simple") {
      return { min: 4, max: 5 };
    }
    if (complexity === "advanced") {
      return { min: 7, max: 8 };
    }
    return { min: 6, max: 7 };
  }

  if (complexity === "simple") {
    return { min: 4, max: 4 };
  }

  if (complexity === "advanced") {
    return { min: 6, max: 8 };
  }

  return { min: 5, max: 6 };
}

function formatRange(range) {
  return range.min === range.max ? String(range.min) : `${range.min} to ${range.max}`;
}

function normalizeExplanationMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(EXPLANATION_MODE_PROFILES, normalized)) {
    return normalized;
  }

  return mapLegacyAudienceToMode(normalized);
}

function mapLegacyAudienceToMode(value) {
  if (value === "engineer") {
    return "technical";
  }
  if (value === "founder" || value === "product manager" || value === "pm") {
    return "quick";
  }
  if (value === "student") {
    return "detailed";
  }
  return "clear";
}

function getExplanationModeProfile(explanationMode) {
  const mode = normalizeExplanationMode(explanationMode);
  return EXPLANATION_MODE_PROFILES[mode] || EXPLANATION_MODE_PROFILES.clear;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function uniqueModels(...values) {
  const seen = new Set();
  const out = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function pickPreferredModel(candidates, preferredOrder) {
  const available = Array.isArray(candidates) ? candidates : [];
  const preferences = Array.isArray(preferredOrder) ? preferredOrder : [];

  for (const preferred of preferences) {
    if (available.includes(preferred)) {
      return preferred;
    }
  }

  return available[0] || "";
}

function getTextResponse(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return text.replace(/^```json\s*|\s*```$/g, "").trim();
}

function getInlineImagePart(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith("image/")) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType
      };
    }
  }

  return null;
}

function buildCastPhotoFallbackSvgDataUrl() {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff5ea"/>
      <stop offset="100%" stop-color="#e9f4f3"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <circle cx="250" cy="160" r="120" fill="#ffd7c7" opacity="0.55"/>
  <circle cx="1360" cy="180" r="140" fill="#c7ebe5" opacity="0.5"/>
  <rect x="120" y="620" width="1360" height="240" rx="24" fill="#d8e2ea"/>

  <g transform="translate(250 280)">
    <circle cx="100" cy="90" r="62" fill="#ffd8ca"/>
    <rect x="48" y="160" width="104" height="190" rx="24" fill="#f57c52"/>
    <text x="100" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#1d2e4a">Mira</text>
  </g>

  <g transform="translate(580 270)">
    <circle cx="100" cy="95" r="60" fill="#ffd7c3"/>
    <rect x="50" y="166" width="100" height="186" rx="24" fill="#e8eef3"/>
    <rect x="91" y="166" width="18" height="186" fill="#2f8f83"/>
    <text x="100" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#1d2e4a">Len</text>
  </g>

  <g transform="translate(900 280)">
    <circle cx="100" cy="90" r="62" fill="#ffd7ca"/>
    <rect x="48" y="160" width="104" height="190" rx="24" fill="#d9a73c"/>
    <text x="100" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#1d2e4a">Dot</text>
  </g>

  <g transform="translate(1210 340)">
    <rect x="25" y="65" width="150" height="170" rx="28" fill="#b6c2ce"/>
    <rect x="48" y="95" width="104" height="72" rx="14" fill="#19364a"/>
    <circle cx="84" cy="130" r="9" fill="#5be1d5"/>
    <circle cx="116" cy="130" r="9" fill="#5be1d5"/>
    <text x="100" y="280" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#1d2e4a">Byte</text>
  </g>
</svg>`;

  const encoded = Buffer.from(svg.replace(/\n+/g, "").trim()).toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}

async function auditPanelAnatomy(imageDataUrl, panel, script, index) {
  try {
    const expectedHumans = Array.isArray(panel?.characters)
      ? panel.characters.filter((name) => name && name !== "Byte")
      : [];
    if (!expectedHumans.length) {
      return { pass: true, issues: [] };
    }
    const prompt = [
      "You are a strict QA reviewer for generated comic panel images.",
      "Check only anatomy and body coherence for each visible human character.",
      "Ignore text quality and ignore non-human robot anatomy.",
      "Fail the image if any human has extra arms/hands/legs/feet/fingers, duplicated heads/torso, impossible limb attachment, or obvious body-part duplication.",
      "If uncertain, mark pass=false to force a safer regeneration.",
      `Panel ${index + 1}/${script.panelCount}.`,
      `Teaching purpose: ${panel.purpose}.`,
      `Expected characters: ${panel.characters.join(", ")}.`,
      expectedHumans.length
        ? `Expected humans to verify strictly: ${expectedHumans.join(", ")}.`
        : "No human verification needed.",
      'Return JSON only: {"pass": true|false, "issues": ["short issue", "..."]}.'
    ].join("\n");

    const response = await callGeminiText({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: dataUrlToInlineData(imageDataUrl) }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const parsed = safeJsonParse(getTextResponse(response));
    if (!parsed || typeof parsed.pass !== "boolean") {
      return { pass: true, issues: ["anatomy audit inconclusive"] };
    }

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((issue) => typeof issue === "string" && issue.trim()).slice(0, 4)
      : [];

    return {
      pass: parsed.pass,
      issues: parsed.pass ? [] : issues.length ? issues : ["anatomy inconsistency detected"]
    };
  } catch {
    return { pass: true, issues: ["anatomy audit request failed"] };
  }
}

async function auditPanelContinuity(imageDataUrl, panel, script, index, references) {
  try {
    const expectedCharacters = Array.isArray(panel?.characters)
      ? panel.characters.filter(Boolean)
      : [];
    if (!expectedCharacters.length) {
      return { pass: true, issues: [] };
    }
    const prompt = [
      "You are a strict QA reviewer for character continuity in illustrated panel sequences.",
      "Compare the candidate panel against the reference images and verify identity consistency.",
      "Fail if a named character's face, hairstyle, outfit palette, accessories, age appearance, or body build deviates noticeably.",
      "Fail if character roles look swapped (for example, Len styled like Mira).",
      "If uncertain, mark pass=false to force safer regeneration.",
      `Panel ${index + 1}/${script.panelCount}.`,
      `Expected characters: ${expectedCharacters.join(", ")}.`,
      "Reference image 1 is the canonical identity sheet.",
      "Reference image 2 (if present) is the previous panel and should preserve continuity.",
      'Return JSON only: {"pass": true|false, "issues": ["short issue", "..."]}.'
    ].join("\n");

    const parts = [{ text: prompt }, { inlineData: dataUrlToInlineData(imageDataUrl) }];
    if (references?.castReferenceImageDataUrl) {
      parts.push({ inlineData: dataUrlToInlineData(references.castReferenceImageDataUrl) });
    }
    if (references?.previousPanelImageDataUrl) {
      parts.push({ inlineData: dataUrlToInlineData(references.previousPanelImageDataUrl) });
    }

    const response = await callGeminiText({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const parsed = safeJsonParse(getTextResponse(response));
    if (!parsed || typeof parsed.pass !== "boolean") {
      return { pass: true, issues: ["continuity audit inconclusive"] };
    }

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((issue) => typeof issue === "string" && issue.trim()).slice(0, 5)
      : [];

    return {
      pass: parsed.pass,
      issues: parsed.pass ? [] : issues.length ? issues : ["character continuity inconsistency detected"]
    };
  } catch {
    return { pass: true, issues: ["continuity audit request failed"] };
  }
}

function countWords(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function stripTrailingPunctuation(value) {
  return value.replace(/[.,;:!?-]+$/g, "");
}

function clampWords(text, maxWords) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text;
  }

  const clipped = words.slice(0, maxWords).join(" ");
  return `${stripTrailingPunctuation(clipped)}.`;
}

function dataUrlToInlineData(dataUrl) {
  const match = /^data:(?<mime>[-\w./+]+);base64,(?<data>[A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match?.groups?.mime || !match?.groups?.data) {
    throw createHttpError(500, "Invalid reference image data URL.");
  }

  return {
    mimeType: match.groups.mime,
    data: match.groups.data
  };
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const cacheControl =
      ext === ".html" || ext === ".css" || ext === ".js"
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=300";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      Pragma: "no-cache",
      Expires: "0"
    });
    res.end(req.method === "HEAD" ? undefined : file);
  } catch {
    const fallback = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[".html"],
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    });
    res.end(req.method === "HEAD" ? undefined : fallback);
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".txt"],
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(createHttpError(413, "Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(createHttpError(400, "Request body must be valid JSON."));
      }
    });

    req.on("error", () => reject(createHttpError(400, "Could not read request body.")));
  });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, "utf8");
    return content.split(/\r?\n/).reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        return accumulator;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      accumulator[key] = value;
      return accumulator;
    }, { ...process.env });
  } catch {
    return { ...process.env };
  }
}
