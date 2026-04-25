export function createAddMcpFormState() {
    return {
        draft: {
            args: [],
            command: "",
            cwd: "",
            enabled: true,
            env: {},
            headers: {},
            name: "",
            tools: ["*"],
            transport: "stdio",
            type: "command",
            url: undefined
        },
        mode: "add",
        step: "name",
        type: "mcp_form"
    };
}
export function createEditMcpFormState(server) {
    return {
        draft: {
            args: [...server.definition.args],
            command: server.definition.command,
            cwd: server.definition.cwd,
            enabled: server.definition.enabled,
            env: { ...server.definition.env },
            headers: { ...(server.definition.headers ?? {}) },
            name: server.name,
            tools: [...(server.definition.tools ?? ["*"])],
            transport: server.definition.transport,
            type: server.definition.type,
            url: server.definition.url
        },
        mode: "edit",
        step: server.definition.type === "http" ? "endpoint" : "endpoint",
        type: "mcp_form"
    };
}
export function getMcpFormInputState(flow) {
    const draft = flow.draft;
    switch (flow.step) {
        case "name":
            return {
                footer: "Enter a unique MCP server name • /cancel stops setup",
                placeholder: "Example: filesystem",
                subtitle: "Step 1 of 6",
                title: "MCP Add: Name"
            };
        case "type":
            return {
                footer: "Choose command, http, or local • /cancel stops setup",
                placeholder: "command | http | local",
                subtitle: "Step 2 of 6",
                title: "MCP Add: Type"
            };
        case "endpoint":
            return draft.type === "http"
                ? {
                    footer: flow.mode === "edit"
                        ? "Enter URL • blank keeps current • /cancel stops editing"
                        : "Enter MCP URL • /cancel stops setup",
                    placeholder: flow.mode === "edit"
                        ? draft.url ?? "https://example.com/mcp"
                        : "https://example.com/mcp",
                    subtitle: flow.mode === "edit" ? "Step 1 of 4" : "Step 3 of 6",
                    title: flow.mode === "edit" ? "MCP Edit: URL" : "MCP Add: URL"
                }
                : {
                    footer: flow.mode === "edit"
                        ? "Enter command • blank keeps current • /cancel stops editing"
                        : "Enter command • /cancel stops setup",
                    placeholder: flow.mode === "edit" ? draft.command || "node" : "node",
                    subtitle: flow.mode === "edit" ? "Step 1 of 4" : "Step 3 of 6",
                    title: flow.mode === "edit" ? "MCP Edit: Command" : "MCP Add: Command"
                };
        case "args":
            return {
                footer: flow.mode === "edit"
                    ? "Use JSON array or space-separated args • blank keeps current"
                    : "Use JSON array or space-separated args • blank skips",
                placeholder: draft.args.length > 0 ? JSON.stringify(draft.args) : "--flag value",
                subtitle: flow.mode === "edit" ? "Step 2 of 4" : "Step 4 of 6",
                title: flow.mode === "edit" ? "MCP Edit: Args" : "MCP Add: Args"
            };
        case "cwd":
            return {
                footer: flow.mode === "edit"
                    ? "Enter cwd relative to config • blank keeps current"
                    : "Enter cwd relative to config • blank skips",
                placeholder: draft.cwd || ".",
                subtitle: flow.mode === "edit" ? "Step 3 of 4" : "Step 5 of 6",
                title: flow.mode === "edit" ? "MCP Edit: Cwd" : "MCP Add: Cwd"
            };
        case "env":
            return {
                footer: flow.mode === "edit"
                    ? "Use KEY=value pairs or JSON object • blank keeps current"
                    : "Use KEY=value pairs or JSON object • blank skips",
                placeholder: Object.keys(draft.env).length > 0
                    ? JSON.stringify(draft.env)
                    : "API_KEY=replace-me",
                subtitle: flow.mode === "edit" ? "Step 4 of 4" : "Step 6 of 6",
                title: flow.mode === "edit" ? "MCP Edit: Env" : "MCP Add: Env"
            };
    }
}
export function applyMcpFormInput(flow, rawInput) {
    const input = rawInput.trim();
    switch (flow.step) {
        case "name":
            if (input.length === 0) {
                return {
                    message: "MCP server name is required.",
                    type: "error"
                };
            }
            return {
                flow: {
                    ...flow,
                    draft: {
                        ...flow.draft,
                        name: input
                    },
                    step: "type"
                },
                type: "continue"
            };
        case "type": {
            const nextType = parseMcpServerType(input);
            if (!nextType) {
                return {
                    message: 'Choose one of: "command", "http", or "local".',
                    type: "error"
                };
            }
            return {
                flow: {
                    ...flow,
                    draft: {
                        ...flow.draft,
                        type: nextType
                    },
                    step: "endpoint"
                },
                type: "continue"
            };
        }
        case "endpoint":
            return {
                flow: {
                    ...flow,
                    draft: flow.draft.type === "http"
                        ? {
                            ...flow.draft,
                            url: resolveEditValue(input, flow.mode, flow.draft.url ?? "")
                        }
                        : {
                            ...flow.draft,
                            command: resolveEditValue(input, flow.mode, flow.draft.command)
                        },
                    step: "args"
                },
                type: "continue"
            };
        case "args": {
            const args = parseArgsInput(input, flow);
            if (args instanceof Error) {
                return {
                    message: args.message,
                    type: "error"
                };
            }
            return {
                flow: {
                    ...flow,
                    draft: {
                        ...flow.draft,
                        args
                    },
                    step: "cwd"
                },
                type: "continue"
            };
        }
        case "cwd":
            return {
                flow: {
                    ...flow,
                    draft: {
                        ...flow.draft,
                        cwd: resolveEditValue(input, flow.mode, flow.draft.cwd)
                    },
                    step: "env"
                },
                type: "continue"
            };
        case "env": {
            const env = parseEnvInput(input, flow);
            if (env instanceof Error) {
                return {
                    message: env.message,
                    type: "error"
                };
            }
            return {
                draft: {
                    ...flow.draft,
                    env
                },
                type: "complete"
            };
        }
    }
}
function parseMcpServerType(value) {
    return value === "command" || value === "http" || value === "local"
        ? value
        : undefined;
}
function resolveEditValue(input, mode, existingValue) {
    if (mode === "edit" && input.length === 0) {
        return existingValue;
    }
    return input;
}
function parseArgsInput(input, flow) {
    if (input.length === 0) {
        return flow.mode === "edit" ? [...flow.draft.args] : [];
    }
    if (input.startsWith("[")) {
        try {
            const parsed = JSON.parse(input);
            if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
                return new Error("Args must be a JSON array of strings.");
            }
            return [...parsed];
        }
        catch {
            return new Error("Args must be valid JSON or a space-separated list.");
        }
    }
    return input.split(/\s+/).filter((entry) => entry.length > 0);
}
function parseEnvInput(input, flow) {
    if (input.length === 0) {
        return flow.mode === "edit" ? { ...flow.draft.env } : {};
    }
    if (input.startsWith("{")) {
        try {
            const parsed = JSON.parse(input);
            if (typeof parsed !== "object" ||
                parsed === null ||
                Object.values(parsed).some((entry) => typeof entry !== "string")) {
                return new Error("Env must be a JSON object with string values.");
            }
            return parsed;
        }
        catch {
            return new Error("Env must be valid JSON or KEY=value pairs.");
        }
    }
    const pairs = input
        .split(/\s*,\s*/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    const record = {};
    for (const pair of pairs) {
        const separatorIndex = pair.indexOf("=");
        if (separatorIndex <= 0) {
            return new Error("Env entries must use KEY=value format.");
        }
        const key = pair.slice(0, separatorIndex).trim();
        const value = pair.slice(separatorIndex + 1).trim();
        if (key.length === 0) {
            return new Error("Env keys cannot be empty.");
        }
        record[key] = value;
    }
    return record;
}
//# sourceMappingURL=mcp-form.js.map