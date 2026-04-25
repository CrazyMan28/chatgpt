import { createHash } from "node:crypto";
const MAX_MODEL_TOOL_NAME_LENGTH = 64;
export class InMemoryToolRegistry {
    registrationsById = new Map();
    toolIdsByOwner = new Map();
    addTools(owner, registrations) {
        const existingToolIds = this.toolIdsByOwner.get(owner) ?? [];
        const nextToolIds = [...existingToolIds];
        for (const registration of registrations) {
            this.registrationsById.set(registration.tool.id, registration);
            nextToolIds.push(registration.tool.id);
        }
        this.toolIdsByOwner.set(owner, nextToolIds);
    }
    replaceOwnerTools(owner, registrations) {
        this.clearOwner(owner);
        this.addTools(owner, registrations);
    }
    clearOwner(owner) {
        const toolIds = this.toolIdsByOwner.get(owner);
        if (!toolIds) {
            return;
        }
        for (const toolId of toolIds) {
            this.registrationsById.delete(toolId);
        }
        this.toolIdsByOwner.delete(owner);
    }
    listTools() {
        return this.listRegistrations().map((registration) => registration.tool);
    }
    listModelTools() {
        return this.listTools().map((tool) => ({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
    }
    async executeTool(name, input) {
        const registration = this.listRegistrations().find((entry) => entry.tool.name === name);
        if (!registration) {
            return {
                content: `Tool "${name}" is not registered.`,
                isError: true
            };
        }
        return registration.execute(input);
    }
    listRegistrations() {
        return [...this.registrationsById.values()].sort((left, right) => left.tool.name.localeCompare(right.tool.name));
    }
}
export function createRegisteredTools(serverName, discoveredTools) {
    const usedNames = new Set();
    return discoveredTools.map((tool) => {
        const name = createModelToolName(serverName, tool.name, usedNames);
        const id = `${serverName}::${tool.name}`;
        return {
            id,
            name,
            owner: serverName,
            source: "mcp",
            originalName: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        };
    });
}
function createModelToolName(serverName, toolName, usedNames) {
    const baseName = sanitizeToolName(`${serverName}__${toolName}`);
    const hash = createHash("sha1")
        .update(`${serverName}:${toolName}`)
        .digest("hex")
        .slice(0, 8);
    const truncated = baseName.length <= MAX_MODEL_TOOL_NAME_LENGTH
        ? baseName
        : `${baseName.slice(0, MAX_MODEL_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
    if (!usedNames.has(truncated)) {
        usedNames.add(truncated);
        return truncated;
    }
    const fallback = `${truncated.slice(0, MAX_MODEL_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
    usedNames.add(fallback);
    return fallback;
}
function sanitizeToolName(value) {
    const sanitized = value
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return sanitized.length > 0 ? sanitized : "tool";
}
//# sourceMappingURL=tool-registry.js.map