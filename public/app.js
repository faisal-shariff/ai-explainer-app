const suggestions = [
  "retrieval augmented generation",
  "vector embeddings",
  "transformers",
  "fine-tuning",
  "hallucinations in LLMs",
  "gradient descent",
  "mixture of experts",
  "agentic workflows"
];

const cast = [
  {
    name: "Mira",
    role: "ML engineer",
    description: "Explains the hard part accurately, with a calm, sharp tone."
  },
  {
    name: "Len",
    role: "Product manager",
    description: "Asks the beginner question everyone else was hiding."
  },
  {
    name: "Dot",
    role: "Data analyst",
    description: "Pushes for evidence, metrics, and practical meaning."
  },
  {
    name: "Byte",
    role: "Automation bot",
    description: "Takes metaphors literally and adds just enough lightness."
  }
];

const storageKey = "concept-strip-studio.saved";
const queryConcept = new URLSearchParams(window.location.search).get("concept");
const isFileProtocol = window.location.protocol === "file:";
const apiRoot = new URL("./", window.location.href);
let selectedAudience = "general";

const form = document.querySelector("#generator-form");
const input = document.querySelector("#concept-input");
const generateButton = document.querySelector("#generate-button");
const statusText = document.querySelector("#status-text");
const runtimeBanner = document.querySelector("#runtime-banner");
const runtimeTitle = document.querySelector("#runtime-title");
const runtimeMessage = document.querySelector("#runtime-message");
const suggestionsRoot = document.querySelector("#suggestions");
const castSelector = document.querySelector("#cast-selector");
const castDetailName = document.querySelector("#cast-detail-name");
const castDetailDescription = document.querySelector("#cast-detail-description");
const emptyState = document.querySelector("#empty-state");
const resultCard = document.querySelector("#result-card");
const comicHook = document.querySelector("#comic-hook");
const comicTitle = document.querySelector("#comic-title");
const comicSummary = document.querySelector("#comic-summary");
const audienceBadge = document.querySelector("#audience-badge");
const complexityBadge = document.querySelector("#complexity-badge");
const panelBadge = document.querySelector("#panel-badge");
const captionBadge = document.querySelector("#caption-badge");
const takeawayList = document.querySelector("#takeaway-list");
const learningGrid = document.querySelector("#learning-grid");
const comicGrid = document.querySelector("#comic-grid");
const saveButton = document.querySelector("#save-button");
const exportButton = document.querySelector("#export-button");
const shareButton = document.querySelector("#share-button");
const savedGrid = document.querySelector("#saved-grid");
const savedCardTemplate = document.querySelector("#saved-card-template");
const audienceOptions = document.querySelector("#audience-options");
const sessionStamp = document.querySelector("#session-stamp");
const teamPhotoFrame = document.querySelector(".team-photo-frame");
const teamPhotoImage = document.querySelector("#team-photo-image");
const teamPhotoFallback = document.querySelector("#team-photo-fallback");
const castOverlay = document.querySelector("#cast-overlay");

let currentComic = null;
let savedComics = loadSavedComics();
let selectedCastName = cast[0]?.name || "";

if (queryConcept) {
  input.value = queryConcept;
}

renderSuggestions();
renderCastSelector();
renderSavedComics();
initializeRuntime();
initializeAudienceOptions();
renderSessionStamp();
initializeTeamPhoto();

form.addEventListener("submit", handleGenerate);
saveButton.addEventListener("click", handleSave);
exportButton.addEventListener("click", () => exportComicPng(currentComic));
shareButton.addEventListener("click", handleShare);

async function handleGenerate(event) {
  event.preventDefault();

  const concept = input.value.trim();
  if (!concept) {
    setStatus("Enter a concept first.");
    input.focus();
    return;
  }

  setBusy(true);
  setStatus("Creating your visual brief and rendering the panel sequence.");

  try {
    if (isFileProtocol) {
      throw new Error("This app must be opened through the local server, not directly from the filesystem.");
    }

    const response = await fetch(buildApiUrl("api/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ concept, audience: selectedAudience })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Generation failed.");
    }

    currentComic = data.comic;
    renderComic(currentComic);
    setStatus("Brief generated. Save it locally or export a shareable PNG.");
  } catch (error) {
    setStatus(error.message || "Could not generate the brief.");
  } finally {
    setBusy(false);
  }
}

function renderSuggestions() {
  suggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = suggestion;
    button.addEventListener("click", () => {
      input.value = suggestion;
      input.focus();
    });
    suggestionsRoot.appendChild(button);
  });
}

function initializeAudienceOptions() {
  audienceOptions.querySelectorAll(".audience-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectedAudience = chip.dataset.audience || "general";
      audienceOptions.querySelectorAll(".audience-chip").forEach((button) => {
        button.classList.toggle("active", button === chip);
      });
    });
  });
}

function renderSessionStamp() {
  if (!sessionStamp) {
    return;
  }

  const now = new Date();
  sessionStamp.textContent = `Live session • ${now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  })} • ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function initializeTeamPhoto() {
  if (!teamPhotoFrame || !teamPhotoImage) {
    return;
  }

  teamPhotoFrame.classList.add("loading");
  teamPhotoFrame.classList.remove("show-fallback");

  try {
    const response = await fetch(buildApiUrl("api/cast-photo"));
    const data = await response.json();

    if (!response.ok || !data?.imageDataUrl) {
      throw new Error(data?.error || "No cast photo available.");
    }

    await waitForImageLoad(teamPhotoImage, data.imageDataUrl);
    renderCastSelector();
    teamPhotoFrame.classList.remove("loading");
  } catch {
    teamPhotoFrame.classList.remove("loading");
    teamPhotoFrame.classList.add("show-fallback");
    if (teamPhotoFallback) {
      teamPhotoFallback.hidden = false;
    }
    renderCastSelector();
  }
}

async function initializeRuntime() {
  if (isFileProtocol) {
    generateButton.disabled = true;
    showRuntimeBanner(
      "Open the app through the local server",
      "You opened the HTML file directly, so the browser blocks the script and API calls that power generation. Start the server from the project folder and open http://127.0.0.1:3000 instead."
    );
    setStatus("Open the app through the local server to generate briefs.");
    return;
  }

  try {
    const response = await fetch(buildApiUrl("api/health"));
    const data = await response.json();

    if (!data.hasApiKey) {
      showRuntimeBanner(
        "App is running, but Gemini is not configured",
        "Add GEMINI_API_KEY to comic-app/.env, restart the server, and reload the page."
      );
      setStatus("App detected. Add GEMINI_API_KEY to generate briefs.");
      return;
    }

    hideRuntimeBanner();
  } catch {
    showRuntimeBanner(
      "Could not reach the app server",
      "The frontend loaded, but /api/health did not respond. Start the local server from comic-app and then open http://127.0.0.1:3000."
    );
    setStatus("Could not reach the local app server.");
  }
}

function renderCastSelector() {
  if (!castSelector) {
    return;
  }

  castSelector.innerHTML = "";
  if (castOverlay) {
    castOverlay.innerHTML = "";
  }

  cast.forEach((character, index) => {
    const isActive = character.name === selectedCastName;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `cast-pill${isActive ? " active" : ""}`;
    pill.setAttribute("aria-pressed", String(isActive));
    pill.textContent = character.name;
    pill.addEventListener("click", () => {
      selectCast(character.name);
    });
    castSelector.appendChild(pill);

    if (castOverlay) {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = `cast-badge${isActive ? " active" : ""}`;
      badge.textContent = character.name;
      badge.style.setProperty("--x", String(getCastAnchorPosition(index)));
      badge.addEventListener("click", () => {
        selectCast(character.name);
      });
      castOverlay.appendChild(badge);
    }
  });

  renderCastDetail();
}

function selectCast(name) {
  selectedCastName = name;
  renderCastSelector();
}

function renderCastDetail() {
  if (!castDetailName || !castDetailDescription) {
    return;
  }

  const selected = cast.find((entry) => entry.name === selectedCastName) || cast[0];
  if (!selected) {
    return;
  }

  castDetailName.textContent = `${selected.name} · ${selected.role}`;
  castDetailDescription.textContent = selected.description;
}

function getCastAnchorPosition(index) {
  const positions = [12.5, 37.5, 62.5, 87.5];
  return positions[index] ?? 50;
}

function renderComic(comic) {
  emptyState.classList.add("hidden");
  resultCard.classList.remove("hidden");

  comicHook.textContent = comic.hook;
  comicTitle.textContent = comic.title;
  comicSummary.textContent = comic.summary;
  audienceBadge.textContent = comic.audienceLabel || formatAudienceLabel(comic.audience);
  complexityBadge.textContent = `${capitalize(comic.complexity)} concept`;
  panelBadge.textContent = `${comic.panelCount} panels`;
  captionBadge.textContent = comic.shareCaption;

  takeawayList.innerHTML = "";
  comic.takeaways.forEach((takeaway) => {
    const item = document.createElement("div");
    item.className = "takeaway-item";
    item.textContent = takeaway;
    takeawayList.appendChild(item);
  });

  renderLearningGrid(comic.learning);

  comicGrid.innerHTML = "";
  comicGrid.style.gridTemplateColumns = `repeat(${getGridColumns(comic.panelCount)}, minmax(0, 1fr))`;

  comic.panels.forEach((panel) => {
    const overlayLayout = getPanelOverlayLayout(panel);
    const panelCard = document.createElement("article");
    panelCard.className = "panel-card";

    const panelHeader = document.createElement("div");
    panelHeader.className = "panel-header";
    const dialogueRibbon = document.createElement("div");
    dialogueRibbon.className = "dialogue-ribbon";

    const image = document.createElement("img");
    image.className = "panel-image";
    image.src = panel.imageDataUrl;
    image.alt = `${comic.title}: panel ${panel.panelNumber}`;

    const caption = document.createElement("div");
    caption.className = "panel-caption";
    caption.textContent = panel.caption;

    const panelStage = document.createElement("div");
    panelStage.className = "panel-stage";

    panel.dialogue.forEach((line, index) => {
      const placement = overlayLayout.bubbles[index];
      const bubble = document.createElement("div");
      bubble.className = `ribbon-bubble ribbon-${placement.side}`;
      bubble.innerHTML = `
        <span class="speaker-tag speaker-${line.speaker.toLowerCase()}">${line.speaker}</span>
        <div>${line.line}</div>
      `;
      dialogueRibbon.appendChild(bubble);
    });

    panelHeader.append(caption, dialogueRibbon);
    panelStage.append(image);
    panelCard.append(panelHeader, panelStage);
    comicGrid.appendChild(panelCard);
  });
}

function renderLearningGrid(learning) {
  learningGrid.innerHTML = "";

  const items = [
    {
      title: "What it is",
      body: learning?.whatItIs || ""
    },
    {
      title: "Common confusion",
      body: learning?.commonConfusion || ""
    },
    {
      title: "When to use it",
      body: learning?.whenToUseIt || ""
    }
  ];

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "learning-card";
    card.innerHTML = `
      <p class="learning-label">${item.title}</p>
      <p class="learning-body">${item.body}</p>
    `;
    learningGrid.appendChild(card);
  });
}

async function handleSave() {
  if (!currentComic) {
    setStatus("Generate a brief before saving.");
    return;
  }

  setStatus("Building a shareable preview image for local save.");

  try {
    const { dataUrl } = await exportComicPng(currentComic, { download: false });
    const savedItem = {
      id: crypto.randomUUID(),
      title: currentComic.title,
      summary: currentComic.summary,
      concept: currentComic.concept,
      createdAt: currentComic.generatedAt,
      previewDataUrl: dataUrl
    };

    savedComics = [savedItem, ...savedComics].slice(0, 12);
    persistSavedComics(savedComics);
    renderSavedComics();
    setStatus("Saved locally in this browser.");
  } catch (error) {
    setStatus(error.message || "Could not save the brief.");
  }
}

async function handleShare() {
  if (!currentComic) {
    setStatus("Generate a brief before sharing.");
    return;
  }

  try {
    const { blob } = await exportComicPng(currentComic, { download: false });
    const file = new File([blob], `${slugify(currentComic.title)}.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: currentComic.title,
        text: currentComic.shareCaption,
        files: [file]
      });
      setStatus("Share sheet opened.");
      return;
    }

    await exportComicPng(currentComic);
    setStatus("Native sharing is unavailable here, so the PNG was downloaded instead.");
  } catch (error) {
    if (error?.name !== "AbortError") {
      setStatus(error.message || "Could not share the brief.");
    }
  }
}

function renderSavedComics() {
  savedGrid.innerHTML = "";

  if (!savedComics.length) {
    const empty = document.createElement("p");
    empty.className = "saved-note";
    empty.textContent = "No saved briefs yet.";
    savedGrid.appendChild(empty);
    return;
  }

  savedComics.forEach((comic) => {
    const node = savedCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".saved-image").src = comic.previewDataUrl;
    node.querySelector(".saved-image").alt = comic.title;
    node.querySelector(".saved-date").textContent = new Date(comic.createdAt).toLocaleString();
    node.querySelector(".saved-title").textContent = comic.title;
    node.querySelector(".saved-summary").textContent = comic.summary;

    node.querySelector(".export-saved").addEventListener("click", () => {
      downloadDataUrl(comic.previewDataUrl, `${slugify(comic.title)}.png`);
    });

    node.querySelector(".delete-saved").addEventListener("click", () => {
      savedComics = savedComics.filter((entry) => entry.id !== comic.id);
      persistSavedComics(savedComics);
      renderSavedComics();
    });

    savedGrid.appendChild(node);
  });
}

function showRuntimeBanner(title, message) {
  runtimeTitle.textContent = title;
  runtimeMessage.textContent = message;
  runtimeBanner.classList.remove("hidden");
}

function hideRuntimeBanner() {
  runtimeBanner.classList.add("hidden");
}

async function exportComicPng(comic, options = { download: true }) {
  if (!comic) {
    throw new Error("No comic is loaded.");
  }

  const canvas = await buildComicCanvas(comic);
  const blob = await canvasToBlob(canvas);
  const dataUrl = canvas.toDataURL("image/png");

  if (options.download !== false) {
    downloadDataUrl(dataUrl, `${slugify(comic.title)}.png`);
  }

  return { blob, dataUrl };
}

async function buildComicCanvas(comic) {
  const panelImages = await Promise.all(comic.panels.map((panel) => loadImage(panel.imageDataUrl)));
  const layout = getCanvasLayout(comic.panelCount);
  const width = 1600;
  const padding = 52;
  const gap = 26;
  const headerLayout = getExportHeaderLayout(width - padding * 2, comic);
  const headerHeight = headerLayout.height;
  const panelWidth = (width - padding * 2 - gap * (layout.columns - 1)) / layout.columns;
  const panelHeight = panelWidth * 0.88;
  const rows = Math.ceil(comic.panelCount / layout.columns);
  const height = Math.ceil(headerHeight + padding + rows * panelHeight + Math.max(0, rows - 1) * gap + padding);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f1e8";
  ctx.fillRect(0, 0, width, height);

  drawCanvasBackground(ctx, width, height);
  drawExportHeader(ctx, padding, 48, width - padding * 2, headerLayout, comic);

  comic.panels.forEach((panel, index) => {
    const row = Math.floor(index / layout.columns);
    const column = index % layout.columns;
    const x = padding + column * (panelWidth + gap);
    const y = headerHeight + row * (panelHeight + gap);
    drawPanel(ctx, panelImages[index], panel, x, y, panelWidth, panelHeight);
  });

  return canvas;
}

function drawCanvasBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fdf7ee");
  gradient.addColorStop(1, "#f7f1e8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(245, 124, 82, 0.08)";
  ctx.beginPath();
  ctx.arc(180, 160, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(47, 143, 131, 0.08)";
  ctx.beginPath();
  ctx.arc(width - 180, 120, 130, 0, Math.PI * 2);
  ctx.fill();
}

function drawPanel(ctx, image, panel, x, y, width, height) {
  const overlayLayout = getPanelOverlayLayout(panel);
  const frameInset = 10;
  const ribbonLayout = getRibbonCanvasLayout(ctx, panel, overlayLayout, width - 32);
  const headerBandHeight = getPanelHeaderBandHeight(ctx, panel, width, ribbonLayout.totalHeight);
  const artX = x + frameInset;
  const artY = y + headerBandHeight;
  const artWidth = width - frameInset * 2;
  const artHeight = height - headerBandHeight - frameInset;

  roundRect(ctx, x, y, width, height, 30, "#fffdf8", "rgba(28, 36, 49, 0.12)");
  roundRect(
    ctx,
    x + 10,
    y + 10,
    width - 20,
    headerBandHeight - 10,
    18,
    "rgba(255, 249, 239, 0.92)",
    "rgba(28, 36, 49, 0.08)"
  );
  drawPanelHeaderText(ctx, panel.caption, x + 24, y + 34, width - 48);
  drawPanelRibbonBubbles(ctx, ribbonLayout, x + 16, y + 52);

  ctx.save();
  roundedClip(ctx, artX, artY, artWidth, artHeight, 24);
  drawCoverImage(ctx, image, artX, artY, artWidth, artHeight);
  ctx.restore();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawPanelHeaderText(ctx, text, x, y, maxWidth) {
  ctx.save();
  ctx.fillStyle = "#1c2431";
  ctx.font = "700 15px 'Manrope', sans-serif";
  wrapCanvasText(ctx, text, x, y, maxWidth, 18, 2);
  ctx.restore();
}

function drawDialogueBubble(ctx, line, x, y, maxWidth, bubbleHeight) {
  const speakerClass = line.speaker.toLowerCase();
  const tagColor = {
    mira: "#f57c52",
    len: "#2f8f83",
    dot: "#c69022",
    byte: "#5e6573"
  }[speakerClass] || "#1c2431";

  roundRect(ctx, x, y, maxWidth, bubbleHeight, 17, "rgba(255, 255, 255, 0.9)", "rgba(28, 36, 49, 0.12)");
  drawBubbleTailShort(ctx, x + 22, y + bubbleHeight - 1);

  drawPill(ctx, x + 8, y + 7, line.speaker, tagColor, "#ffffff", 16, 18, 12, 8);

  ctx.fillStyle = "#1c2431";
  ctx.font = "500 14px 'Manrope', sans-serif";
  wrapCanvasText(ctx, line.line, x + 9, y + 32, maxWidth - 18, 17, 7, false);
}

function drawPanelRibbonBubbles(ctx, ribbonLayout, x, y) {
  ribbonLayout.bubbles.forEach((bubble, index) => {
    drawDialogueBubble(
      ctx,
      ribbonLayout.dialogue[index],
      x + bubble.x,
      y + bubble.y,
      bubble.width,
      bubble.height
    );
  });
}

function getRibbonCanvasLayout(ctx, panel, overlayLayout, width) {
  const colWidth = width / 3;
  const sideY = {
    left: 0,
    center: 0,
    right: 0
  };
  const bubbles = [];
  const dialogue = panel.dialogue || [];

  dialogue.forEach((line, index) => {
    const placement = overlayLayout.bubbles[index] || { side: "center" };
    const side = ["left", "center", "right"].includes(placement.side) ? placement.side : "center";
    const bubbleWidth = Math.min(colWidth - 10, 186);
    const bubbleHeight = drawBubbleMeasurement(ctx, line, bubbleWidth);
    const bubbleXBase = side === "left" ? 0 : side === "right" ? colWidth * 2 : colWidth;
    const bubbleX = side === "right" ? bubbleXBase + colWidth - bubbleWidth - 6 : bubbleXBase + 6;
    const bubbleY = sideY[side];
    sideY[side] += bubbleHeight + 8;

    bubbles.push({
      x: bubbleX,
      y: bubbleY,
      width: bubbleWidth,
      height: bubbleHeight
    });
  });

  const tallestTrack = Math.max(sideY.left, sideY.center, sideY.right, 40);
  return {
    bubbles,
    dialogue,
    totalHeight: tallestTrack + 4
  };
}

function getPanelHeaderBandHeight(ctx, panel, width, ribbonHeight) {
  const titleLines = estimateTextLines(ctx, panel.caption, width - 48, "700 15px 'Manrope', sans-serif");
  const titleHeight = Math.min(2, titleLines) * 18;
  return 28 + titleHeight + ribbonHeight + 8;
}

function drawBubbleMeasurement(ctx, line, maxWidth) {
  ctx.save();
  ctx.font = "500 14px 'Manrope', sans-serif";
  const lines = breakCanvasText(ctx, line.line, maxWidth - 18).slice(0, 7);
  ctx.restore();
  const lineCount = Math.max(lines.length, 1);
  return 14 + 16 + 7 + lineCount * 17;
}

function drawPill(
  ctx,
  x,
  y,
  text,
  fill,
  textFill,
  minWidth = 170,
  height = 42,
  fontSize = 12,
  textInset = 8
) {
  ctx.save();
  const width = Math.max(
    minWidth,
    textInset * 2 + measureTextWidth(ctx, text, `700 ${fontSize}px 'Manrope', sans-serif`)
  );
  roundRect(ctx, x, y, width, height, height / 2, fill, fill);
  ctx.fillStyle = textFill;
  ctx.font = `700 ${fontSize}px 'Manrope', sans-serif`;
  ctx.fillText(text, x + textInset, y + height - Math.max(4, Math.floor(fontSize * 0.35)));
  ctx.restore();
}

function drawBubbleTailShort(ctx, startX, startY) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(28, 36, 49, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX - 8, startY);
  ctx.lineTo(startX, startY + 9);
  ctx.lineTo(startX + 8, startY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function getPanelOverlayLayout(panel) {
  const anchors = getSpeakerAnchors(panel.staging, panel.characters, panel.dialogue);

  const bubbles = panel.dialogue.map((line, index) => {
    const anchor = anchors.get(line.speaker) || { x: 50, y: 70, side: "center" };
    void index;
    return { side: anchor.side };
  });

  return { bubbles };
}

function getSpeakerAnchors(staging, characters, dialogue) {
  const map = new Map();
  const stagingSlots = {
    left: { x: 22, y: 69, side: "left" },
    center: { x: 50, y: 69, side: "center" },
    right: { x: 78, y: 69, side: "right" }
  };

  if (staging && typeof staging === "object") {
    Object.entries(stagingSlots).forEach(([slot, anchor]) => {
      const name = staging[slot];
      if (typeof name === "string" && name.trim()) {
        map.set(name, anchor);
      }
    });
  }

  // Fallback if staging is incomplete: infer from participant list.
  const participants = [...new Set((characters || []).concat(dialogue.map((line) => line.speaker)))];
  const fallbackXs =
    participants.length <= 1 ? [50] : participants.length === 2 ? [22, 78] : [22, 50, 78];
  participants.slice(0, 3).forEach((speaker, index) => {
    if (!map.has(speaker)) {
      const x = fallbackXs[index] ?? 50;
      map.set(speaker, {
        x,
        y: speaker === "Byte" ? 73 : 69,
        side: x < 35 ? "left" : x > 65 ? "right" : "center"
      });
    }
  });

  return map;
}

function estimateTextLines(ctx, text, maxWidth, font) {
  ctx.save();
  ctx.font = font;
  const lines = breakCanvasText(ctx, text, maxWidth).length;
  ctx.restore();
  return lines;
}

function measureTextWidth(ctx, text, font) {
  ctx.save();
  ctx.font = font;
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

function roundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function roundedClip(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.clip();
}

function breakCanvasText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines, ellipsize = true) {
  const broken = breakCanvasText(ctx, text, maxWidth);
  const lines = broken.slice(0, maxLines);
  lines.forEach((line, index) => {
    const shouldEllipsize = ellipsize && index === maxLines - 1 && broken.length > maxLines;
    const rendered = shouldEllipsize ? `${line.replace(/[.,;:!?-]$/, "")}…` : line;
    ctx.fillText(rendered, x, y + index * lineHeight);
  });
}

function getExportHeaderLayout(maxWidth, comic) {
  const measurementCanvas = document.createElement("canvas");
  const ctx = measurementCanvas.getContext("2d");
  const titleLines = breakTextWithFont(
    ctx,
    comic.title,
    maxWidth - 80,
    "700 60px 'Plus Jakarta Sans', sans-serif"
  ).slice(0, 2);
  const summaryLines = breakTextWithFont(
    ctx,
    comic.summary,
    maxWidth - 80,
    "500 26px 'Manrope', sans-serif"
  ).slice(0, 3);

  const titleHeight = titleLines.length * 68;
  const summaryHeight = summaryLines.length * 34;
  return {
    titleLines,
    summaryLines,
    height: 60 + titleHeight + 18 + summaryHeight + 54
  };
}

function drawExportHeader(ctx, x, y, width, layout, comic) {
  ctx.fillStyle = "#1c2431";
  ctx.font = "700 60px 'Plus Jakarta Sans', sans-serif";
  layout.titleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * 68);
  });

  const summaryStartY = y + layout.titleLines.length * 68 + 18;
  ctx.fillStyle = "#5d6776";
  ctx.font = "500 26px 'Manrope', sans-serif";
  layout.summaryLines.forEach((line, index) => {
    ctx.fillText(line, x, summaryStartY + index * 34);
  });

  const pillY = summaryStartY + layout.summaryLines.length * 34 + 20;
  drawPill(ctx, x, pillY, `${capitalize(comic.complexity)} concept`, "#1c2431", "#ffffff", 170, 42, 22, 14);
  drawPill(ctx, x + 220, pillY, `${comic.panelCount} panels`, "#1c2431", "#ffffff", 170, 42, 22, 14);
}

function breakTextWithFont(ctx, text, maxWidth, font) {
  ctx.save();
  ctx.font = font;
  const lines = breakCanvasText(ctx, text, maxWidth);
  ctx.restore();
  return lines;
}

function getCanvasLayout(panelCount) {
  if (panelCount <= 2) {
    return { columns: panelCount };
  }

  if (panelCount <= 4) {
    return { columns: 2 };
  }

  if (panelCount <= 6) {
    return { columns: 2 };
  }

  return { columns: 3 };
}

function getGridColumns(panelCount) {
  return getCanvasLayout(panelCount).columns;
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  saveButton.disabled = isBusy;
  exportButton.disabled = isBusy;
  shareButton.disabled = isBusy;
  generateButton.textContent = isBusy ? "Generating..." : "Generate brief";
}

function setStatus(message) {
  statusText.textContent = message;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAudienceLabel(value) {
  if (!value) {
    return "General audience";
  }

  if (value === "product manager") {
    return "Product managers";
  }

  if (value === "general") {
    return "General audience";
  }

  return `${capitalize(value)} audience`;
}

function loadSavedComics() {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedComics(comics) {
  localStorage.setItem(storageKey, JSON.stringify(comics));
}

function downloadDataUrl(dataUrl, filename) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load generated panel image."));
    image.src = src;
  });
}

function waitForImageLoad(image, src) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load team photo."));
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not render PNG export."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildApiUrl(pathname) {
  return new URL(pathname, apiRoot).toString();
}
