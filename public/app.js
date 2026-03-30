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

const preloadedHowStrip = {
  sourceLabel: "Preloaded sample strip",
  slides: [
    {
      imageUrl: "./examples/rag-sample/panel-1.jpg",
      caption: "LLMs aren't internet browsers.",
      dialogue: [
        { speaker: "Len", line: "So, our new LLM knows everything, right?" },
        {
          speaker: "Mira",
          line: "LLMs generate from patterns in training data, not from browsing live internet."
        }
      ]
    },
    {
      imageUrl: "./examples/rag-sample/panel-2.jpg",
      caption: "Outdated info or made-up facts.",
      dialogue: [
        { speaker: "Len", line: "But it can give me today's market news instantly?" },
        {
          speaker: "Mira",
          line: "Without fresh sources, it can sound plausible while still being wrong."
        }
      ]
    },
    {
      imageUrl: "./examples/rag-sample/panel-3.jpg",
      caption: "Enhancing LLMs with facts.",
      dialogue: [
        { speaker: "Dot", line: "How do we make answers accurate and current?" },
        {
          speaker: "Mira",
          line: "Use Retrieval Augmented Generation: fetch relevant facts before the model responds."
        }
      ]
    },
    {
      imageUrl: "./examples/rag-sample/panel-4.jpg",
      caption: "Retrieve, then generate.",
      dialogue: [
        { speaker: "Len", line: "So it just magically finds the right info?" },
        {
          speaker: "Mira",
          line: "It queries a knowledge base first, then passes that context into the LLM."
        }
      ]
    },
    {
      imageUrl: "./examples/rag-sample/panel-5.jpg",
      caption: "Accurate, verifiable AI answers.",
      dialogue: [
        { speaker: "Dot", line: "Could our internal policy bot use this pattern?" },
        {
          speaker: "Mira",
          line: "Yes. RAG keeps answers precise and verifiable against official documents."
        }
      ]
    }
  ]
};

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
let selectedExplanationMode = "clear";

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
const modeBadge = document.querySelector("#mode-badge");
const complexityBadge = document.querySelector("#complexity-badge");
const panelBadge = document.querySelector("#panel-badge");
const captionBadge = document.querySelector("#caption-badge");
const takeawayList = document.querySelector("#takeaway-list");
const learningGrid = document.querySelector("#learning-grid");
const comicGrid = document.querySelector("#comic-grid");
const generatedCarouselControls = document.querySelector("#generated-carousel-controls");
const generatedCarouselPrev = document.querySelector("#generated-carousel-prev");
const generatedCarouselNext = document.querySelector("#generated-carousel-next");
const generatedCarouselStatus = document.querySelector("#generated-carousel-status");
const saveButton = document.querySelector("#save-button");
const shareButton = document.querySelector("#share-button");
const savedGrid = document.querySelector("#saved-grid");
const savedCardTemplate = document.querySelector("#saved-card-template");
const modeOptions = document.querySelector("#mode-options");
const sessionStamp = document.querySelector("#session-stamp");
const teamPhotoFrame = document.querySelector(".team-photo-frame");
const teamPhotoImage = document.querySelector("#team-photo-image");
const teamPhotoFallback = document.querySelector("#team-photo-fallback");
const castOverlay = document.querySelector("#cast-overlay");
const navLinks = document.querySelectorAll(".js-nav-link");
const howCarouselTrack = document.querySelector("#how-carousel-track");
const howCarouselCaption = document.querySelector("#how-carousel-caption");
const howCarouselPrev = document.querySelector("#how-carousel-prev");
const howCarouselNext = document.querySelector("#how-carousel-next");
const howCarouselDialogueList = document.querySelector("#how-carousel-dialogue-list");
const footerShareCta = document.querySelector("#footer-share-cta");
const savedModal = document.querySelector("#saved-modal");
const savedModalClose = document.querySelector("#saved-modal-close");
const savedModalPrev = document.querySelector("#saved-modal-prev");
const savedModalNext = document.querySelector("#saved-modal-next");
const savedModalPanelLabel = document.querySelector("#saved-modal-panel-label");
const savedModalTitle = document.querySelector("#saved-modal-title");
const savedModalDate = document.querySelector("#saved-modal-date");
const savedModalTrack = document.querySelector("#saved-modal-track");
const savedModalDialogue = document.querySelector("#saved-modal-dialogue");
const savedModalCaption = document.querySelector("#saved-modal-caption");
const savedModalViewer = document.querySelector("#saved-modal-viewer");
const savedModalLegacy = document.querySelector("#saved-modal-legacy");
const savedModalImage = document.querySelector("#saved-modal-image");

let currentComic = null;
let savedComics = loadSavedComics();
let selectedCastName = cast[0]?.name || "";
let howCarouselSlides = [];
let howCarouselIndex = 0;
let howCarouselSource = "";
let howCarouselAutoplayTimer = null;
let generatedCarouselIndex = 0;
let generatedCarouselScrollRaf = null;
let generatorCueTimer = null;
let savedModalSlides = [];
let savedModalIndex = 0;

if (queryConcept) {
  input.value = queryConcept;
}

renderSuggestions();
renderCastSelector();
renderSavedComics();
initializeRuntime();
initializeExplanationModeOptions();
renderSessionStamp();
initializeTeamPhoto();
initializeTopNavLinks();
initializeHowCarousel();
window.addEventListener("resize", handleViewportChange);

form.addEventListener("submit", handleGenerate);
saveButton.addEventListener("click", handleSave);
shareButton.addEventListener("click", handleShare);
footerShareCta?.addEventListener("click", handleFooterShare);
generatedCarouselPrev?.addEventListener("click", () => moveGeneratedCarousel(-1));
generatedCarouselNext?.addEventListener("click", () => moveGeneratedCarousel(1));
comicGrid?.addEventListener("scroll", handleGeneratedCarouselScroll, { passive: true });
savedModalClose?.addEventListener("click", closeSavedModal);
savedModalPrev?.addEventListener("click", () => moveSavedModalCarousel(-1));
savedModalNext?.addEventListener("click", () => moveSavedModalCarousel(1));
savedModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (target.closest("[data-close-saved-modal]")) {
    closeSavedModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSavedModal();
    return;
  }

  if (!savedModal || savedModal.classList.contains("hidden")) {
    return;
  }

  if (event.key === "ArrowLeft") {
    moveSavedModalCarousel(-1);
  } else if (event.key === "ArrowRight") {
    moveSavedModalCarousel(1);
  }
});

async function handleGenerate(event) {
  event.preventDefault();

  const concept = input.value.trim();
  if (!concept) {
    setStatus("Enter a concept first.");
    input.focus();
    return;
  }

  setBusy(true);
  setStatus("Creating your visual.");

  try {
    if (isFileProtocol) {
      throw new Error("This app must be opened through the local server, not directly from the filesystem.");
    }

    const response = await fetch(buildApiUrl("api/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ concept, explanationMode: selectedExplanationMode })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Generation failed.");
    }

    currentComic = data.comic;
    renderComic(currentComic);
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus("Visual generated. Save it locally or share it.");
  } catch (error) {
    setStatus(error.message || "Could not generate the visual.");
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

function initializeExplanationModeOptions() {
  if (!modeOptions) {
    return;
  }

  modeOptions.querySelectorAll(".mode-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectedExplanationMode = chip.dataset.mode || "clear";
      modeOptions.querySelectorAll(".mode-chip").forEach((button) => {
        button.classList.toggle("active", button === chip);
      });
    });
  });
}

function renderSessionStamp() {
  return;
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
    setStatus("Open the app through the local server to generate visuals.");
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
      setStatus("App detected. Add GEMINI_API_KEY to generate visuals.");
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
  generatedCarouselIndex = 0;

  comicHook.textContent = comic.hook;
  comicTitle.textContent = comic.title;
  comicSummary.textContent = comic.summary;
  modeBadge.textContent = comic.modeLabel || formatExplanationModeLabel(comic.explanationMode || selectedExplanationMode);
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

  updateComicGridLayout(comic.panelCount);
  if (comicGrid.classList.contains("comic-grid-carousel")) {
    comicGrid.scrollLeft = 0;
  }
  updateGeneratedCarouselControls();
}

function initializeTopNavLinks() {
  if (!navLinks.length) {
    return;
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetHash = link.getAttribute("href");
      if (!targetHash || !targetHash.startsWith("#")) {
        return;
      }

      const target = document.querySelector(targetHash);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      if (targetHash === "#generator-form" && input) {
        setTimeout(() => {
          emphasizeGeneratorInput();
        }, 260);
      }
    });
  });
}

function emphasizeGeneratorInput() {
  if (!form || !input) {
    return;
  }

  if (generatorCueTimer) {
    clearTimeout(generatorCueTimer);
    generatorCueTimer = null;
  }

  form.classList.remove("start-here");
  input.classList.remove("start-here-input");

  // Force reflow so the pulse animation reliably restarts.
  void form.offsetWidth;

  form.classList.add("start-here");
  input.classList.add("start-here-input");
  input.focus({ preventScroll: true });
  input.select();
  setStatus("Start here: type the concept you want explained.");

  generatorCueTimer = window.setTimeout(() => {
    form.classList.remove("start-here");
    input.classList.remove("start-here-input");
    generatorCueTimer = null;
  }, 2600);
}

function initializeHowCarousel() {
  if (!howCarouselTrack || !howCarouselCaption) {
    return;
  }

  howCarouselPrev?.addEventListener("click", () => {
    moveHowCarousel(-1, true);
  });

  howCarouselNext?.addEventListener("click", () => {
    moveHowCarousel(1, true);
  });

  setHowCarouselFromPreloaded(preloadedHowStrip);
}

function setHowCarouselFromPreloaded(strip) {
  if (!howCarouselTrack || !Array.isArray(strip?.slides) || !strip.slides.length) {
    return;
  }

  howCarouselSlides = strip.slides.map((slide) => ({
    imageDataUrl: buildApiUrl(slide.imageUrl),
    caption: slide.caption,
    purpose: "sample",
    dialogue: Array.isArray(slide.dialogue) ? slide.dialogue.slice(0, 2) : []
  }));
  howCarouselIndex = 0;
  howCarouselSource = strip.sourceLabel || "Preloaded strip";
  renderHowCarouselSlides();
  updateHowCarouselPosition();
  restartHowCarouselAutoplay();
}

function setHowCarouselPlaceholder(message) {
  if (!howCarouselTrack || !howCarouselCaption) {
    return;
  }

  howCarouselSlides = [];
  howCarouselIndex = 0;
  clearHowCarouselAutoplay();
  howCarouselTrack.style.transform = "translateX(0%)";

  howCarouselTrack.innerHTML = `
    <article class="how-carousel-placeholder">
      <p>${message}</p>
    </article>
  `;
  if (howCarouselDialogueList) {
    howCarouselDialogueList.innerHTML = "";
  }
  howCarouselCaption.textContent = message;
  updateHowCarouselButtonState();
}

function renderHowCarouselSlides() {
  if (!howCarouselTrack) {
    return;
  }

  howCarouselTrack.innerHTML = "";

  howCarouselSlides.forEach((slide, index) => {
    const panel = document.createElement("article");
    panel.className = "how-carousel-slide";

    const image = document.createElement("img");
    image.src = slide.imageDataUrl;
    image.alt = `Example strip panel ${index + 1}`;
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";

    const meta = document.createElement("div");
    meta.className = "how-carousel-slide-meta";
    meta.textContent = `Panel ${index + 1}`;

    panel.append(image, meta);
    howCarouselTrack.appendChild(panel);
  });

  updateHowCarouselButtonState();
}

function moveHowCarousel(step, userInitiated = false) {
  if (!howCarouselSlides.length) {
    return;
  }

  const nextIndex = (howCarouselIndex + step + howCarouselSlides.length) % howCarouselSlides.length;
  howCarouselIndex = nextIndex;
  updateHowCarouselPosition();

  if (userInitiated) {
    restartHowCarouselAutoplay();
  }
}

function updateHowCarouselPosition() {
  if (!howCarouselTrack || !howCarouselCaption || !howCarouselSlides.length) {
    return;
  }

  howCarouselTrack.style.transform = `translateX(-${howCarouselIndex * 100}%)`;
  const current = howCarouselSlides[howCarouselIndex];
  renderHowCarouselDialogue(current);
  const contextLine = current.caption || current.purpose || "Explanation step";
  howCarouselCaption.textContent = `${howCarouselSource} • Panel ${howCarouselIndex + 1}/${howCarouselSlides.length} • ${contextLine}`;
}

function renderHowCarouselDialogue(slide) {
  if (!howCarouselDialogueList) {
    return;
  }

  howCarouselDialogueList.innerHTML = "";
  const lines = Array.isArray(slide?.dialogue) ? slide.dialogue : [];

  lines.forEach((line) => {
    const row = document.createElement("article");
    row.className = "how-carousel-dialogue-row";
    row.innerHTML = `
      <span class="speaker-tag speaker-${String(line.speaker || "mira").toLowerCase()}">${line.speaker || "Guide"}</span>
      <p>${line.line || ""}</p>
    `;
    howCarouselDialogueList.appendChild(row);
  });
}

function updateHowCarouselButtonState() {
  const disabled = howCarouselSlides.length <= 1;
  if (howCarouselPrev) {
    howCarouselPrev.disabled = disabled;
  }
  if (howCarouselNext) {
    howCarouselNext.disabled = disabled;
  }
}

function restartHowCarouselAutoplay() {
  clearHowCarouselAutoplay();
  if (howCarouselSlides.length <= 1) {
    return;
  }

  howCarouselAutoplayTimer = window.setInterval(() => {
    moveHowCarousel(1, false);
  }, 6200);
}

function clearHowCarouselAutoplay() {
  if (!howCarouselAutoplayTimer) {
    return;
  }

  clearInterval(howCarouselAutoplayTimer);
  howCarouselAutoplayTimer = null;
}

function updateComicGridLayout(panelCount) {
  if (!comicGrid) {
    return;
  }

  const isSmallViewport = window.matchMedia("(max-width: 1100px)").matches;
  comicGrid.classList.toggle("comic-grid-carousel", isSmallViewport);

  if (isSmallViewport) {
    comicGrid.style.gridTemplateColumns = "";
    updateGeneratedCarouselControls();
    return;
  }

  comicGrid.style.gridTemplateColumns = `repeat(${getGridColumns(panelCount)}, minmax(0, 1fr))`;
  updateGeneratedCarouselControls();
}

function handleViewportChange() {
  if (!currentComic) {
    return;
  }

  updateComicGridLayout(currentComic.panelCount);
  syncGeneratedCarouselIndexFromScroll();
}

function getGeneratedPanelCards() {
  if (!comicGrid) {
    return [];
  }

  return Array.from(comicGrid.querySelectorAll(".panel-card"));
}

function isGeneratedCarouselActive() {
  if (!comicGrid) {
    return false;
  }

  const isSmallViewport = window.matchMedia("(max-width: 1100px)").matches;
  return isSmallViewport && getGeneratedPanelCards().length > 1;
}

function updateGeneratedCarouselControls() {
  if (!generatedCarouselControls) {
    return;
  }

  const cards = getGeneratedPanelCards();
  const isActive = isGeneratedCarouselActive() && cards.length > 1;
  generatedCarouselControls.classList.toggle("hidden", !isActive);

  if (!isActive) {
    return;
  }

  generatedCarouselIndex = Math.max(0, Math.min(generatedCarouselIndex, cards.length - 1));

  if (generatedCarouselStatus) {
    generatedCarouselStatus.textContent = `Panel ${generatedCarouselIndex + 1} of ${cards.length}`;
  }

  if (generatedCarouselPrev) {
    generatedCarouselPrev.disabled = generatedCarouselIndex === 0;
  }

  if (generatedCarouselNext) {
    generatedCarouselNext.disabled = generatedCarouselIndex >= cards.length - 1;
  }
}

function moveGeneratedCarousel(step) {
  if (!isGeneratedCarouselActive()) {
    return;
  }

  const cards = getGeneratedPanelCards();
  if (!cards.length) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(generatedCarouselIndex + step, cards.length - 1));
  generatedCarouselIndex = nextIndex;
  cards[nextIndex].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  updateGeneratedCarouselControls();
}

function syncGeneratedCarouselIndexFromScroll() {
  if (!comicGrid || !isGeneratedCarouselActive()) {
    return;
  }

  const cards = getGeneratedPanelCards();
  if (!cards.length) {
    return;
  }

  const left = comicGrid.scrollLeft;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const distance = Math.abs(card.offsetLeft - left);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestIndex !== generatedCarouselIndex) {
    generatedCarouselIndex = nearestIndex;
  }
  updateGeneratedCarouselControls();
}

function handleGeneratedCarouselScroll() {
  if (!isGeneratedCarouselActive()) {
    return;
  }

  if (generatedCarouselScrollRaf) {
    return;
  }

  generatedCarouselScrollRaf = window.requestAnimationFrame(() => {
    generatedCarouselScrollRaf = null;
    syncGeneratedCarouselIndexFromScroll();
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
    setStatus("Generate a visual before saving.");
    return;
  }

  setStatus("Saving this visual locally.");

  try {
    const previewDataUrl = await buildSavedPreviewDataUrl(currentComic);
    const viewerSlides = buildSavedViewerSlides(currentComic);
    let fullStripDataUrl = "";
    if (!viewerSlides.length) {
      fullStripDataUrl = await buildSavedFullStripDataUrl(currentComic);
    }

    const savedItem = {
      id: crypto.randomUUID(),
      title: currentComic.title,
      summary: currentComic.summary,
      concept: currentComic.concept,
      panelCount: currentComic.panelCount,
      complexity: currentComic.complexity,
      formatVersion: 2,
      createdAt: currentComic.generatedAt,
      previewDataUrl,
      viewerSlides,
      fullStripDataUrl
    };

    savedComics = [savedItem, ...savedComics].slice(0, 12);
    persistSavedComics(savedComics);
    renderSavedComics();
    setStatus("Saved locally. Open it from Your Saved Visuals to view panel-by-panel.");
  } catch (error) {
    setStatus(error.message || "Could not save the visual.");
  }
}

async function buildSavedPreviewDataUrl(comic) {
  const firstPanelDataUrl = comic?.panels?.[0]?.imageDataUrl;
  if (typeof firstPanelDataUrl === "string" && firstPanelDataUrl.trim().length > 0) {
    return firstPanelDataUrl;
  }

  const { dataUrl } = await exportComicPng(comic, { download: false });
  return dataUrl;
}

function buildSavedViewerSlides(comic) {
  if (!Array.isArray(comic?.panels)) {
    return [];
  }

  return comic.panels.map((panel) => ({
    imageDataUrl: panel.imageDataUrl,
    caption: panel.caption || "",
    dialogue: Array.isArray(panel.dialogue)
      ? panel.dialogue.slice(0, 3).map((line) => ({
          speaker: line.speaker || "Guide",
          line: line.line || ""
        }))
      : []
  }));
}

async function buildSavedFullStripDataUrl(comic) {
  const canvas = await buildComicCanvas(comic, { includeHeader: false, widthOverride: 1700 });
  const targetWidth = Math.min(1500, canvas.width);

  if (canvas.width <= targetWidth) {
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  const scale = targetWidth / canvas.width;
  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = Math.round(canvas.width * scale);
  scaledCanvas.height = Math.round(canvas.height * scale);
  const scaledCtx = scaledCanvas.getContext("2d");
  scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  return scaledCanvas.toDataURL("image/jpeg", 0.88);
}

async function handleShare() {
  if (!currentComic) {
    setStatus("Generate a visual before sharing.");
    return;
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?concept=${encodeURIComponent(
    currentComic.concept || input.value.trim()
  )}`;
  const shareText = `${currentComic.title} — ${currentComic.summary}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: currentComic.title,
        text: shareText,
        url: shareUrl
      });
      setStatus("Share sheet opened.");
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("Share link copied to clipboard.");
      return;
    } catch {
      // Fall through to status fallback.
    }
  }

  setStatus(`Share this link: ${shareUrl}`);
}

async function handleFooterShare() {
  const url = `${window.location.origin}${window.location.pathname}`;
  const shareText = "Try Concept Clarity for visual AI explainers.";

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Concept Clarity",
        text: shareText,
        url
      });
      setStatus("Share sheet opened.");
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied. Share it with a friend.");
      return;
    } catch {
      // Fall through to status fallback.
    }
  }

  setStatus(`Share this link: ${url}`);
}

function renderSavedComics() {
  savedGrid.innerHTML = "";

  if (!savedComics.length) {
    const empty = document.createElement("p");
    empty.className = "saved-note";
    empty.textContent = "No saved visuals yet.";
    savedGrid.appendChild(empty);
    return;
  }

  savedComics.forEach((comic) => {
    const node = savedCardTemplate.content.firstElementChild.cloneNode(true);
    const savedImage = node.querySelector(".saved-image");
    const savedDate = node.querySelector(".saved-date");
    const savedTitle = node.querySelector(".saved-title");
    const savedSummary = node.querySelector(".saved-summary");
    const viewButton = node.querySelector(".view-saved");
    const media = node.querySelector(".saved-media");

    savedImage.src = comic.previewDataUrl;
    savedImage.alt = comic.title;
    savedDate.textContent = new Date(comic.createdAt).toLocaleString();
    savedTitle.textContent = comic.title;
    savedSummary.textContent = comic.summary;

    viewButton.addEventListener("click", () => {
      openSavedModal(comic);
    });

    media.addEventListener("click", () => {
      openSavedModal(comic);
    });
    media.tabIndex = 0;
    media.setAttribute("role", "button");
    media.setAttribute("aria-label", `Open ${comic.title}`);
    media.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSavedModal(comic);
      }
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

function openSavedModal(comic) {
  if (!savedModal || !savedModalTitle || !savedModalDate) {
    return;
  }

  savedModalTitle.textContent = comic.title || "Saved visual";
  const dateText = comic.createdAt ? new Date(comic.createdAt).toLocaleString() : "";
  const panelText = Number.isFinite(comic.panelCount) ? `${comic.panelCount} panels` : "";
  savedModalDate.textContent = [dateText, panelText].filter(Boolean).join(" • ");

  savedModalSlides = getSavedModalSlides(comic);
  savedModalIndex = 0;

  const hasPanelSlides = savedModalSlides.length > 0;
  if (savedModalViewer) {
    savedModalViewer.classList.toggle("hidden", !hasPanelSlides);
  }
  if (savedModalLegacy) {
    savedModalLegacy.classList.toggle("hidden", hasPanelSlides);
  }
  if (savedModalPanelLabel) {
    savedModalPanelLabel.classList.toggle("hidden", !hasPanelSlides);
  }
  if (savedModalPrev) {
    savedModalPrev.classList.toggle("hidden", !hasPanelSlides);
    savedModalPrev.disabled = !hasPanelSlides;
  }
  if (savedModalNext) {
    savedModalNext.classList.toggle("hidden", !hasPanelSlides);
    savedModalNext.disabled = !hasPanelSlides;
  }

  if (hasPanelSlides) {
    renderSavedModalSlides();
    updateSavedModalPosition();
  } else if (savedModalImage) {
    savedModalImage.src = comic.fullStripDataUrl || comic.previewDataUrl;
    savedModalImage.alt = comic.title || "Saved visual";
  }

  savedModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeSavedModal() {
  if (!savedModal || savedModal.classList.contains("hidden")) {
    return;
  }

  savedModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  savedModalSlides = [];
  savedModalIndex = 0;
}

function getSavedModalSlides(comic) {
  if (Array.isArray(comic?.viewerSlides) && comic.viewerSlides.length) {
    return comic.viewerSlides
      .map((slide) => ({
        imageDataUrl: slide.imageDataUrl,
        caption: slide.caption || "",
        dialogue: Array.isArray(slide.dialogue) ? slide.dialogue : []
      }))
      .filter((slide) => typeof slide.imageDataUrl === "string" && slide.imageDataUrl.length > 0);
  }

  if (Array.isArray(comic?.panels) && comic.panels.length) {
    return comic.panels.map((panel) => ({
      imageDataUrl: panel.imageDataUrl,
      caption: panel.caption || "",
      dialogue: Array.isArray(panel.dialogue) ? panel.dialogue : []
    }));
  }

  return [];
}

function renderSavedModalSlides() {
  if (!savedModalTrack) {
    return;
  }

  savedModalTrack.innerHTML = "";
  savedModalSlides.forEach((slide, index) => {
    const panel = document.createElement("article");
    panel.className = "saved-modal-slide";

    const image = document.createElement("img");
    image.src = slide.imageDataUrl;
    image.alt = `Saved visual panel ${index + 1}`;
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";

    const meta = document.createElement("div");
    meta.className = "saved-modal-slide-meta";
    meta.textContent = `Panel ${index + 1}`;

    panel.append(image, meta);
    savedModalTrack.appendChild(panel);
  });
}

function updateSavedModalPosition() {
  if (!savedModalTrack || !savedModalSlides.length) {
    return;
  }

  savedModalTrack.style.transform = `translateX(-${savedModalIndex * 100}%)`;
  const current = savedModalSlides[savedModalIndex];

  if (savedModalPanelLabel) {
    savedModalPanelLabel.textContent = `${savedModalIndex + 1} / ${savedModalSlides.length}`;
  }

  if (savedModalCaption) {
    savedModalCaption.textContent = current.caption || "";
  }

  if (savedModalPrev) {
    savedModalPrev.disabled = savedModalIndex === 0;
  }
  if (savedModalNext) {
    savedModalNext.disabled = savedModalIndex >= savedModalSlides.length - 1;
  }

  renderSavedModalDialogue(current);
}

function renderSavedModalDialogue(slide) {
  if (!savedModalDialogue) {
    return;
  }

  savedModalDialogue.innerHTML = "";
  const lines = Array.isArray(slide?.dialogue) ? slide.dialogue.slice(0, 3) : [];

  lines.forEach((line) => {
    const row = document.createElement("article");
    row.className = "saved-modal-dialogue-row";
    row.innerHTML = `
      <span class="speaker-tag speaker-${String(line.speaker || "mira").toLowerCase()}">${line.speaker || "Guide"}</span>
      <p>${line.line || ""}</p>
    `;
    savedModalDialogue.appendChild(row);
  });
}

function moveSavedModalCarousel(step) {
  if (!savedModalSlides.length) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(savedModalIndex + step, savedModalSlides.length - 1));
  if (nextIndex === savedModalIndex) {
    return;
  }

  savedModalIndex = nextIndex;
  updateSavedModalPosition();
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

async function buildComicCanvas(comic, options = {}) {
  const includeHeader = options.includeHeader !== false;
  const widthOverride = Number.isFinite(options.widthOverride) ? options.widthOverride : null;
  const panelImages = await Promise.all(comic.panels.map((panel) => loadImage(panel.imageDataUrl)));
  const columns = getExportColumns(comic.panelCount);
  const width = widthOverride || (columns === 1 ? 1320 : 1900);
  const padding = 52;
  const gap = 26;
  const headerLayout = includeHeader ? getExportHeaderLayout(width - padding * 2, comic) : null;
  const headerHeight = includeHeader ? headerLayout.height : 0;
  const panelWidth = (width - padding * 2 - gap * (columns - 1)) / columns;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const panelLayouts = comic.panels.map((panel) => getExportPanelLayout(measureCtx, panel, panelWidth));
  const rowHeights = [];

  panelLayouts.forEach((layout, index) => {
    const row = Math.floor(index / columns);
    rowHeights[row] = Math.max(rowHeights[row] || 0, layout.totalHeight);
  });

  const rows = rowHeights.length;
  const contentHeight = rowHeights.reduce((sum, value) => sum + value, 0);
  const topInset = includeHeader ? headerHeight + padding : padding;
  const height = Math.ceil(topInset + contentHeight + Math.max(0, rows - 1) * gap + padding);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f1e8";
  ctx.fillRect(0, 0, width, height);

  drawCanvasBackground(ctx, width, height);
  if (includeHeader && headerLayout) {
    drawExportHeader(ctx, padding, 48, width - padding * 2, headerLayout, comic);
  }

  let rowStartY = topInset;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col;
      if (index >= comic.panels.length) {
        break;
      }

      const x = padding + col * (panelWidth + gap);
      drawExportPanelCard(ctx, panelImages[index], comic.panels[index], x, rowStartY, panelWidth, panelLayouts[index]);
    }
    rowStartY += rowHeights[row] + gap;
  }

  return canvas;
}

function getExportColumns(panelCount) {
  if (panelCount <= 1) {
    return 1;
  }
  return 2;
}

function getExportPanelLayout(ctx, panel, panelWidth) {
  const outerInset = 14;
  const innerWidth = panelWidth - outerInset * 2;
  const captionLines = breakTextWithFont(
    ctx,
    panel.caption || "",
    innerWidth - 24,
    "700 30px 'Manrope', sans-serif"
  ).slice(0, 3);
  const captionHeight = 22 + captionLines.length * 36;
  const imageHeight = Math.round(innerWidth * 0.72);
  const dialogue = (panel.dialogue || []).slice(0, 3).map((line) => {
    const textLines = breakTextWithFont(
      ctx,
      line.line || "",
      innerWidth - 24,
      "500 23px 'Manrope', sans-serif"
    ).slice(0, 6);
    const lineCount = Math.max(textLines.length, 1);
    const bubbleHeight = 18 + 28 + lineCount * 29;
    return {
      speaker: line.speaker || "Guide",
      textLines,
      bubbleHeight
    };
  });

  const dialogueGap = 10;
  const dialogueHeight = dialogue.length
    ? dialogue.reduce((sum, item) => sum + item.bubbleHeight, 0) + dialogueGap * (dialogue.length - 1)
    : 0;
  const totalHeight =
    outerInset +
    captionHeight +
    12 +
    imageHeight +
    (dialogueHeight > 0 ? 12 + dialogueHeight : 0) +
    outerInset;

  return {
    outerInset,
    innerWidth,
    captionLines,
    captionHeight,
    imageHeight,
    dialogue,
    totalHeight
  };
}

function drawExportPanelCard(ctx, image, panel, x, y, panelWidth, layout) {
  roundRect(ctx, x, y, panelWidth, layout.totalHeight, 24, "#fffdf8", "rgba(28, 36, 49, 0.14)");

  const innerX = x + layout.outerInset;
  let cursorY = y + layout.outerInset;

  roundRect(
    ctx,
    innerX,
    cursorY,
    layout.innerWidth,
    layout.captionHeight,
    14,
    "rgba(255, 249, 239, 0.94)",
    "rgba(28, 36, 49, 0.1)"
  );

  ctx.save();
  ctx.fillStyle = "#1c2431";
  ctx.font = "700 30px 'Manrope', sans-serif";
  layout.captionLines.forEach((line, index) => {
    ctx.fillText(line, innerX + 12, cursorY + 40 + index * 34);
  });
  ctx.restore();

  cursorY += layout.captionHeight + 12;

  ctx.save();
  roundedClip(ctx, innerX, cursorY, layout.innerWidth, layout.imageHeight, 16);
  drawCoverImage(ctx, image, innerX, cursorY, layout.innerWidth, layout.imageHeight);
  ctx.restore();

  cursorY += layout.imageHeight + 12;

  layout.dialogue.forEach((line) => {
    drawExportDialogueRow(ctx, line, innerX, cursorY, layout.innerWidth, line.bubbleHeight);
    cursorY += line.bubbleHeight + 10;
  });
}

function drawExportDialogueRow(ctx, line, x, y, width, height) {
  const speakerClass = String(line.speaker || "").toLowerCase();
  const tagColor = {
    mira: "#f57c52",
    len: "#2f8f83",
    dot: "#c69022",
    byte: "#5e6573"
  }[speakerClass] || "#1c2431";

  roundRect(ctx, x, y, width, height, 12, "rgba(255, 255, 255, 0.94)", "rgba(28, 36, 49, 0.12)");
  drawPill(ctx, x + 10, y + 10, line.speaker || "Guide", tagColor, "#ffffff", 20, 24, 14, 10);

  ctx.save();
  ctx.fillStyle = "#1f3149";
  ctx.font = "500 23px 'Manrope', sans-serif";
  line.textLines.forEach((textLine, index) => {
    ctx.fillText(textLine, x + 12, y + 50 + index * 28);
  });
  ctx.restore();
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
    "700 64px 'Plus Jakarta Sans', sans-serif"
  ).slice(0, 2);
  const summaryLines = breakTextWithFont(
    ctx,
    comic.summary,
    maxWidth - 80,
    "500 30px 'Manrope', sans-serif"
  ).slice(0, 3);

  const titleHeight = titleLines.length * 72;
  const summaryHeight = summaryLines.length * 38;
  return {
    titleLines,
    summaryLines,
    height: 64 + titleHeight + 20 + summaryHeight + 58
  };
}

function drawExportHeader(ctx, x, y, width, layout, comic) {
  ctx.fillStyle = "#1c2431";
  ctx.font = "700 64px 'Plus Jakarta Sans', sans-serif";
  layout.titleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * 72);
  });

  const summaryStartY = y + layout.titleLines.length * 72 + 20;
  ctx.fillStyle = "#5d6776";
  ctx.font = "500 30px 'Manrope', sans-serif";
  layout.summaryLines.forEach((line, index) => {
    ctx.fillText(line, x, summaryStartY + index * 38);
  });

  const pillY = summaryStartY + layout.summaryLines.length * 38 + 24;
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
  shareButton.disabled = isBusy;
  generateButton.textContent = isBusy ? "Generating..." : "Generate";
}

function setStatus(message) {
  statusText.textContent = message;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatExplanationModeLabel(value) {
  const mode = String(value || "").toLowerCase();
  if (mode === "quick") {
    return "Quick explainer";
  }
  if (mode === "detailed") {
    return "Detailed explainer";
  }
  if (mode === "technical") {
    return "Technical explainer";
  }
  return "Clear explainer";
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
