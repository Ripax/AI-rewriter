/* =========================
   ELEMENTS
========================= */

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");

const providerRadios = document.querySelectorAll('input[name="aiProvider"]');
const openaiSettings = document.getElementById("openaiSettings");
const ollamaSettings = document.getElementById("ollamaSettings");
const chatgptModelSettings = document.getElementById("chatgptModelSettings");

const ollamaModelSelect = document.getElementById("ollamaModel");

const apiStatusText = document.getElementById("apiStatusText");
const themeToggle = document.getElementById("themeToggle");

const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const rewriteBtn = document.getElementById("rewriteBtn");
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copyBtn");

const popupContainer = document.querySelector(".popup-container");

/* TEMPLATE UI */
const dropdown = document.getElementById("templateDropdown");
const dropdownTrigger = document.getElementById("dropdownTrigger");
const dropdownMenu = document.getElementById("dropdownMenu");
const selectedTemplateLabel = document.getElementById("selectedTemplate");
const templateHint = document.getElementById("templateHint");

/* =========================
   STATE
========================= */

let activeProvider = "openai";
let selectedTemplate = null;
let ollamaWatcher = null;

/* =========================
   CONSTANTS
========================= */

const OLLAMA_TAGS = "http://localhost:11434/api/tags";

/* =========================
   HELPERS
========================= */

function updateMainStatus(text, isError = false) {
    apiStatusText.textContent = text;
    apiStatusText.style.color = isError ? "#ff6b6b" : "";
}

/* 🔼 Auto resize textarea */
function autoResizeTextarea(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    animatePopupHeight();
}

/* 🪄 Smooth popup height animation */
function animatePopupHeight() {
    requestAnimationFrame(() => {
        popupContainer.style.height = "auto";
        const height = popupContainer.scrollHeight;
        popupContainer.style.height = height + "px";
    });
}

function buildFinalPrompt() {
    if (selectedTemplate) return TEMPLATES[selectedTemplate];
    return `Rewrite this professionally:\n\n${inputText.value}`;
}

function updateInputVisibility() {
    const usingTemplate = selectedTemplate !== null;
    rewriteBtn.textContent = usingTemplate ? "Generate" : "Rewrite";
    inputText.disabled = usingTemplate;
    inputText.style.opacity = usingTemplate ? "0.5" : "1";
    inputText.placeholder = usingTemplate
        ? "Template-based generation"
        : "Paste text here";
    templateHint?.classList.toggle("hidden", !usingTemplate);
}

/* =========================
   THEME
========================= */

function applyTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    themeToggle.checked = theme === "dark";
}

themeToggle.onchange = () => {
    const theme = themeToggle.checked ? "dark" : "light";
    chrome.storage.local.set({ THEME: theme });
    applyTheme(theme);
};

/* =========================
   TEMPLATE DROPDOWN
========================= */

dropdownTrigger.onclick = e => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
};

document.addEventListener("click", () =>
    dropdown.classList.remove("open")
);

function buildTemplateDropdown() {
    dropdownMenu.innerHTML = "";
    Object.entries(TEMPLATE_CONFIG).forEach(([group, items]) => {
        const header = document.createElement("div");
        header.className = "dropdown-group";
        header.textContent = group;
        dropdownMenu.appendChild(header);

        items.forEach(({ key, label }) => {
            const item = document.createElement("div");
            item.className = "dropdown-item";
            item.textContent = label;
            item.onclick = () => {
                selectedTemplate = key;
                selectedTemplateLabel.textContent = label;
                dropdown.classList.remove("open");
                updateInputVisibility();
                animatePopupHeight();
            };
            dropdownMenu.appendChild(item);
        });
    });
}

/* =========================
   SETTINGS
========================= */

settingsBtn.onclick = () => {
    settingsPanel.classList.toggle("hidden");
    animatePopupHeight();
};

closeSettings.onclick = () => {
    settingsPanel.classList.add("hidden");
    animatePopupHeight();
};

/* =========================
   PROVIDER SWITCH
========================= */

function updateProviderUI() {
    openaiSettings.classList.toggle("hidden", activeProvider !== "openai");
    chatgptModelSettings.classList.toggle("hidden", activeProvider !== "openai");
    ollamaSettings.classList.toggle("hidden", activeProvider !== "local");

    if (activeProvider === "local") {
        connectOllama();
        if (!ollamaWatcher) {
            ollamaWatcher = setInterval(connectOllama, 10000);
        }
    } else {
        clearInterval(ollamaWatcher);
        ollamaWatcher = null;
    }

    animatePopupHeight();
}

providerRadios.forEach(radio => {
    radio.onchange = () => {
        activeProvider = radio.value;
        chrome.storage.local.set({ AI_PROVIDER: activeProvider });
        updateProviderUI();
    };
});

/* =========================
   OLLAMA (REMEMBER MODEL)
========================= */

async function connectOllama() {
    try {
        const res = await fetch(OLLAMA_TAGS);
        if (!res.ok) throw new Error();

        const data = await res.json();
        const models = data.models || [];
        ollamaModelSelect.innerHTML = "";

        const { OLLAMA_MODEL } = await chrome.storage.local.get("OLLAMA_MODEL");

        models.forEach(m => {
            const name = m.name || m.model;
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            if (name === OLLAMA_MODEL) opt.selected = true;
            ollamaModelSelect.appendChild(opt);
        });

        updateMainStatus(`Local • ${ollamaModelSelect.value}`);
        animatePopupHeight();
    } catch {
        updateMainStatus("Local • Ollama offline ❌", true);
        ollamaSettings.classList.add("hidden");
    }
}

ollamaModelSelect.onchange = () => {
    chrome.storage.local.set({
        OLLAMA_MODEL: ollamaModelSelect.value
    });
};

/* =========================
   REWRITE
========================= */

rewriteBtn.onclick = () => {
    spinner.classList.remove("hidden");
    rewriteBtn.disabled = true;
    outputText.value = "";
    autoResizeTextarea(outputText);

    if (activeProvider === "local") {
        chrome.runtime.sendMessage(
            {
                action: "ollama-generate",
                model: ollamaModelSelect.value,
                prompt: buildFinalPrompt()
            },
            res => {
                spinner.classList.add("hidden");
                rewriteBtn.disabled = false;
                outputText.value = res?.ok ? res.output : res?.error;
                autoResizeTextarea(outputText);
                copyBtn.classList.remove("hidden");
            }
        );
    }
};

/* =========================
   OUTPUT AUTO RESIZE
========================= */

outputText.addEventListener("input", () =>
    autoResizeTextarea(outputText)
);

/* =========================
   COPY
========================= */

copyBtn.onclick = () => {
    navigator.clipboard.writeText(outputText.value);
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
};

/* =========================
   INIT
========================= */

chrome.storage.local.get(
    ["AI_PROVIDER", "THEME"],
    res => {
        activeProvider = res.AI_PROVIDER || "openai";
        providerRadios.forEach(
            r => (r.checked = r.value === activeProvider)
        );

        applyTheme(res.THEME || "dark");
        buildTemplateDropdown();
        selectedTemplateLabel.textContent = "None";
        updateInputVisibility();
        updateProviderUI();
        animatePopupHeight();
    }
);