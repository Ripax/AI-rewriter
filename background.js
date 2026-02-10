// background.js (FINAL)

/* =========================
   STARTUP
========================= */

console.log("✅ background service worker started");

/* =========================
   MESSAGE ROUTER
========================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("📨 background received:", msg);

    if (msg.action === "ollama-generate") {
        handleOllamaGenerate(msg, sendResponse);
        return true; // keep channel open
    }
});

/* =========================
   OLLAMA GENERATION
========================= */

async function handleOllamaGenerate(msg, sendResponse) {
    let { model, prompt } = msg;

    // Normalize model name
    if (!model.includes(":")) {
        model = `${model}:latest`;
    }

    console.log("🦙 Using model:", model);

    try {
        const payload = {
            model,
            prompt,
            stream: false
        };

        console.log("🦙 Payload:", payload);

        const res = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("❌ Ollama HTTP error:", res.status, text);
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        console.log("🦙 Ollama response:", data);

        sendResponse({
            ok: true,
            output: data.response || ""
        });

    } catch (err) {
        console.error("❌ Ollama failed:", err);

        sendResponse({
            ok: false,
            error: err.message || "Ollama generation failed"
        });
    }
}