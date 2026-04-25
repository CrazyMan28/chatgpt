export function buildPreviewReply({ modelConfig, prompt, tools }) {
    const sourceCounts = tools.reduce((counts, tool) => {
        counts[tool.source] += 1;
        return counts;
    }, {
        core: 0,
        mcp: 0
    });
    return [
        "UI preview only. Agent execution is intentionally disconnected in Step 5.",
        `Captured input: ${prompt}`,
        `Selected model: ${modelConfig.provider} / ${modelConfig.model}`,
        `Registry status: ${tools.length} tools loaded (${sourceCounts.core} core, ${sourceCounts.mcp} MCP)`,
        "This shell is ready to validate layout, streaming, scrolling, spacing, and dynamic registry rendering before wiring the real agent."
    ].join("\n\n");
}
//# sourceMappingURL=preview.js.map