import { readFile } from "node:fs/promises";
import { isRecord, truncate } from "./utils.js";
const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_MISTRAL_VISION_MODEL = "mistral-small-latest";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export function createVisionProvider(config, auth) {
    if (config.visionProvider === "ollama") {
        return new OllamaVisionProvider(config, auth);
    }
    if (config.visionProvider === "local") {
        return new LocalOpenAiCompatibleVisionProvider(config, auth);
    }
    return new MistralVisionProvider(config, auth);
}
class MistralVisionProvider {
    config;
    auth;
    constructor(config, auth) {
        this.config = config;
        this.auth = auth;
    }
    get apiKey() {
        return (this.auth?.mistralApiKey?.trim() ||
            process.env.CHATGPT_CODE_MISTRAL_API_KEY?.trim() ||
            process.env.MISTRAL_API_KEY?.trim() ||
            undefined);
    }
    get baseUrl() {
        return (this.auth?.mistralBaseUrl?.trim() ||
            process.env.CHATGPT_CODE_MISTRAL_BASE_URL?.trim() ||
            DEFAULT_MISTRAL_BASE_URL);
    }
    get model() {
        return (this.config.visionModel ||
            this.auth?.mistralModel?.trim() ||
            process.env.CHATGPT_CODE_MISTRAL_VISION_MODEL?.trim() ||
            DEFAULT_MISTRAL_VISION_MODEL);
    }
    status() {
        return {
            baseUrl: this.baseUrl,
            configured: Boolean(this.apiKey),
            model: this.model,
            provider: "mistral",
            reason: this.apiKey
                ? undefined
                : "Set CHATGPT_CODE_MISTRAL_API_KEY, MISTRAL_API_KEY, or log in to the Mistral provider.",
            supportsVision: Boolean(this.apiKey)
        };
    }
    async describeScreen(image, prompt, context) {
        return this.requestVision({
            images: [await toImageInput(image, true)],
            prompt: buildVisionPrompt(prompt ||
                "Describe the current desktop screenshot. Identify windows, controls, text fields, buttons, menus, and likely next actions.", context)
        });
    }
    async locateElement(image, target, context) {
        return this.requestVision({
            images: [await toImageInput(image, true)],
            prompt: buildVisionPrompt(`Locate this UI target on the screen: ${target}. Return approximate boxes and suggested actions only if confidence is reasonable.`, context)
        });
    }
    async compareScreens(before, after, prompt) {
        return this.requestVision({
            images: [await toImageInput(before, true), await toImageInput(after, true)],
            prompt: buildVisionPrompt(prompt ||
                "Compare the before and after desktop screenshots. Summarize visible progress, unchanged areas, errors, or dialogs.", {
                image_order: ["before", "after"]
            })
        });
    }
    async extractText(image, prompt) {
        return this.requestVision({
            images: [await toImageInput(image, true)],
            prompt: buildVisionPrompt(prompt ||
                "Extract visible UI text from this screenshot and return relevant fields or messages.")
        });
    }
    async requestVision(input) {
        if (!this.apiKey) {
            throw new Error("Mistral vision is not configured. Set CHATGPT_CODE_MISTRAL_API_KEY, MISTRAL_API_KEY, or log in to the Mistral provider.");
        }
        const content = [
            {
                type: "text",
                text: input.prompt
            },
            ...input.images.map((image) => ({
                type: "image_url",
                image_url: {
                    url: image
                }
            }))
        ];
        const response = await fetchJson(new URL("chat/completions", withTrailingSlash(this.baseUrl)).toString(), {
            body: JSON.stringify({
                messages: [
                    {
                        content,
                        role: "user"
                    }
                ],
                model: this.model
            }),
            headers: {
                authorization: `Bearer ${this.apiKey}`,
                "content-type": "application/json"
            },
            method: "POST",
            timeoutMs: 120_000
        });
        const text = readMistralText(response);
        return parseVisionObservation(text);
    }
}
class OllamaVisionProvider {
    config;
    auth;
    constructor(config, auth) {
        this.config = config;
        this.auth = auth;
    }
    get baseUrl() {
        return (this.auth?.ollamaBaseUrl?.trim() ||
            process.env.CHATGPT_CODE_OLLAMA_BASE_URL?.trim() ||
            process.env.OLLAMA_HOST?.trim() ||
            DEFAULT_OLLAMA_BASE_URL);
    }
    get model() {
        return (this.config.visionModel ||
            this.auth?.ollamaModel?.trim() ||
            process.env.CHATGPT_CODE_OLLAMA_VISION_MODEL?.trim() ||
            process.env.CHATGPT_CODE_MODEL?.trim() ||
            undefined);
    }
    status() {
        const model = this.model;
        return {
            baseUrl: this.baseUrl,
            configured: Boolean(model),
            model,
            provider: "ollama",
            reason: model
                ? inferOllamaVisionSupport(model) === false
                    ? "Selected Ollama model does not support image input."
                    : undefined
                : "Set /vision model <name> or CHATGPT_CODE_DESKTOP_VISION_MODEL.",
            supportsVision: model ? inferOllamaVisionSupport(model) : false
        };
    }
    async describeScreen(image, prompt, context) {
        return this.requestVision({
            images: [await toImageInput(image, false)],
            prompt: buildVisionPrompt(prompt ||
                "Describe the current desktop screenshot. Identify windows, controls, text fields, buttons, menus, and likely next actions.", context)
        });
    }
    async locateElement(image, target, context) {
        return this.requestVision({
            images: [await toImageInput(image, false)],
            prompt: buildVisionPrompt(`Locate this UI target on the screen: ${target}. Return approximate boxes and suggested actions only if confidence is reasonable.`, context)
        });
    }
    async compareScreens(before, after, prompt) {
        return this.requestVision({
            images: [await toImageInput(before, false), await toImageInput(after, false)],
            prompt: buildVisionPrompt(prompt ||
                "Compare the before and after desktop screenshots. Summarize visible progress, unchanged areas, errors, or dialogs.", {
                image_order: ["before", "after"]
            })
        });
    }
    async extractText(image, prompt) {
        return this.requestVision({
            images: [await toImageInput(image, false)],
            prompt: buildVisionPrompt(prompt ||
                "Extract visible UI text from this screenshot and return relevant fields or messages.")
        });
    }
    async requestVision(input) {
        if (!this.model) {
            throw new Error("Ollama vision model is not configured. Use /vision model <name>.");
        }
        const support = inferOllamaVisionSupport(this.model);
        if (support === false) {
            throw new Error("Selected Ollama model does not support image input.");
        }
        const response = await fetchJson(new URL("api/chat", withTrailingSlash(this.baseUrl)).toString(), {
            body: JSON.stringify({
                messages: [
                    {
                        content: input.prompt,
                        images: input.images,
                        role: "user"
                    }
                ],
                model: this.model,
                stream: false
            }),
            headers: {
                "content-type": "application/json"
            },
            method: "POST",
            timeoutMs: 180_000
        });
        return parseVisionObservation(response.message?.content ?? "");
    }
}
class LocalOpenAiCompatibleVisionProvider {
    config;
    auth;
    constructor(config, auth) {
        this.config = config;
        this.auth = auth;
    }
    status() {
        return {
            baseUrl: this.auth?.localBaseUrl ?? process.env.CHATGPT_CODE_LOCAL_BASE_URL,
            configured: false,
            model: this.config.visionModel ?? this.auth?.localModel,
            provider: "local",
            reason: "OpenAI-compatible local vision endpoints are reserved for a later adapter. Use mistral or ollama for now.",
            supportsVision: "unknown"
        };
    }
    async describeScreen() {
        throw new Error(this.status().reason);
    }
    async locateElement() {
        throw new Error(this.status().reason);
    }
    async compareScreens() {
        throw new Error(this.status().reason);
    }
    async extractText() {
        throw new Error(this.status().reason);
    }
}
async function fetchJson(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, options.timeoutMs);
    try {
        const response = await fetch(url, {
            body: options.body,
            headers: options.headers,
            method: options.method,
            signal: controller.signal
        });
        if (!response.ok) {
            const detail = truncate((await response.text()).trim(), 500);
            throw new Error(`Vision provider returned HTTP ${response.status}: ${detail}`);
        }
        return (await response.json());
    }
    finally {
        clearTimeout(timer);
    }
}
async function toImageInput(image, dataUri) {
    const path = typeof image === "string" ? image : image.path;
    const base64 = (await readFile(path)).toString("base64");
    return dataUri ? `data:image/png;base64,${base64}` : base64;
}
function buildVisionPrompt(prompt, context) {
    return [
        prompt,
        "",
        "Return only JSON matching this TypeScript shape:",
        "{",
        '  "screen_summary": "string",',
        '  "visible_windows": ["string"],',
        '  "visible_elements": [{"label":"string","type":"button|text_field|menu|link|unknown","approx_box":[0,0,0,0],"confidence":0.0,"reason":"string"}],',
        '  "suggested_actions": [{"type":"click|type|scroll|wait|keypress","target":"string","x":0,"y":0,"text":"string","confidence":0.0,"reason":"string"}]',
        "}",
        context ? `Context JSON: ${JSON.stringify(context)}` : undefined
    ]
        .filter((line) => Boolean(line))
        .join("\n");
}
function readMistralText(response) {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((part) => part.text)
            .filter((part) => typeof part === "string")
            .join("");
    }
    return "";
}
function parseVisionObservation(raw) {
    const parsed = parseJsonFromText(raw);
    if (!isRecord(parsed)) {
        return {
            screen_summary: raw.trim() || "Vision provider returned no summary.",
            suggested_actions: [],
            visible_elements: [],
            visible_windows: []
        };
    }
    const visibleElements = Array.isArray(parsed.visible_elements)
        ? parsed.visible_elements
            .filter(isRecord)
            .map((entry) => ({
            approx_box: parseBox(entry.approx_box),
            confidence: parseConfidence(entry.confidence),
            label: typeof entry.label === "string" ? entry.label : "",
            reason: typeof entry.reason === "string" ? entry.reason : undefined,
            type: parseElementType(entry.type)
        }))
            .filter((entry) => entry.label.length > 0)
        : [];
    const suggestedActions = Array.isArray(parsed.suggested_actions)
        ? parsed.suggested_actions
            .filter(isRecord)
            .map((entry) => ({
            confidence: parseConfidence(entry.confidence),
            reason: typeof entry.reason === "string" ? entry.reason : undefined,
            target: typeof entry.target === "string" ? entry.target : undefined,
            text: typeof entry.text === "string" ? entry.text : undefined,
            type: parseActionType(entry.type),
            x: typeof entry.x === "number" && Number.isFinite(entry.x) ? entry.x : undefined,
            y: typeof entry.y === "number" && Number.isFinite(entry.y) ? entry.y : undefined
        }))
            .filter((entry) => entry.type !== undefined)
            .map((entry) => ({
            ...entry,
            type: entry.type ?? "wait"
        }))
        : [];
    return {
        screen_summary: typeof parsed.screen_summary === "string"
            ? parsed.screen_summary
            : raw.trim() || "Vision provider returned structured data without a summary.",
        suggested_actions: suggestedActions,
        visible_elements: visibleElements,
        visible_windows: Array.isArray(parsed.visible_windows)
            ? parsed.visible_windows.filter((entry) => typeof entry === "string")
            : []
    };
}
function parseJsonFromText(raw) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const unfenced = trimmed
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    try {
        return JSON.parse(unfenced);
    }
    catch {
        const start = unfenced.indexOf("{");
        const end = unfenced.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(unfenced.slice(start, end + 1));
            }
            catch {
                return undefined;
            }
        }
        return undefined;
    }
}
function parseBox(value) {
    if (!Array.isArray(value) || value.length !== 4) {
        return undefined;
    }
    const numbers = value.map((entry) => Number(entry));
    if (!numbers.every(Number.isFinite)) {
        return undefined;
    }
    return [numbers[0], numbers[1], numbers[2], numbers[3]];
}
function parseConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(1, numeric));
}
function parseElementType(value) {
    return value === "button" ||
        value === "text_field" ||
        value === "menu" ||
        value === "link"
        ? value
        : "unknown";
}
function parseActionType(value) {
    return value === "click" ||
        value === "type" ||
        value === "scroll" ||
        value === "wait" ||
        value === "keypress"
        ? value
        : undefined;
}
function withTrailingSlash(value) {
    return value.endsWith("/") ? value : `${value}/`;
}
function inferOllamaVisionSupport(model) {
    const normalized = model.toLowerCase();
    if (/vision|llava|bakllava|moondream|minicpm-v|minicpm|qwen.*vl|qwen-vl|gemma3|gemma4|llama3\.2-vision|granite.*vision/.test(normalized)) {
        return true;
    }
    if (/llama|mistral|mixtral|deepseek|phi|qwen|gemma|codellama/.test(normalized)) {
        return false;
    }
    return "unknown";
}
//# sourceMappingURL=vision.js.map