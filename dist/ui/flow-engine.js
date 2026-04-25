export function createFlow(id, steps, state = {}) {
    return {
        id,
        state,
        stepIndex: 0,
        steps,
        value: ""
    };
}
export function getVisibleFlowSteps(flow) {
    return flow.steps.filter((step) => step.condition?.(flow.state) ?? true);
}
export function getActiveFlowStep(flow) {
    const visibleSteps = getVisibleFlowSteps(flow);
    return visibleSteps[Math.min(flow.stepIndex, visibleSteps.length - 1)] ?? visibleSteps[0];
}
export function getFlowOptions(flow) {
    const step = getActiveFlowStep(flow);
    const options = step.options;
    if (!options) {
        return [];
    }
    return typeof options === "function" ? options(flow.state) : options;
}
export function resolveFlowTitle(flow) {
    const step = getActiveFlowStep(flow);
    return typeof step.title === "function" ? step.title(flow.state) : step.title;
}
export function resolveFlowDescription(flow) {
    const step = getActiveFlowStep(flow);
    return typeof step.description === "function"
        ? step.description(flow.state)
        : step.description;
}
export function resolveFlowPlaceholder(flow) {
    const step = getActiveFlowStep(flow);
    if (!step.placeholder) {
        return undefined;
    }
    return typeof step.placeholder === "function"
        ? step.placeholder(flow.state)
        : step.placeholder;
}
export function moveFlowSelection(flow, direction) {
    const options = getFlowOptions(flow);
    if (options.length === 0) {
        return flow;
    }
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === flow.value));
    const nextIndex = direction === "next"
        ? (currentIndex + 1) % options.length
        : (currentIndex - 1 + options.length) % options.length;
    return {
        ...flow,
        value: options[nextIndex]?.value ?? flow.value
    };
}
export function primeFlow(flow) {
    const step = getActiveFlowStep(flow);
    if (step.inputType === "text") {
        return flow;
    }
    const options = getFlowOptions(flow);
    if (options.length === 0 || flow.value.trim().length > 0) {
        return flow;
    }
    return {
        ...flow,
        value: options[0].value
    };
}
export function advanceFlow(flow, rawValue) {
    const visibleSteps = getVisibleFlowSteps(flow);
    const currentStep = getActiveFlowStep(flow);
    const nextState = {
        ...flow.state,
        [currentStep.key]: rawValue
    };
    const nextIndex = flow.stepIndex + 1;
    if (nextIndex >= visibleSteps.length) {
        return undefined;
    }
    const nextFlow = {
        ...flow,
        state: nextState,
        stepIndex: nextIndex,
        value: ""
    };
    return primeFlow(nextFlow);
}
export function formatFlowStepLabel(flow) {
    const visibleSteps = getVisibleFlowSteps(flow);
    return `Step ${Math.min(flow.stepIndex + 1, visibleSteps.length)}/${visibleSteps.length}`;
}
export function snapshotFlowState(flow) {
    const currentStep = getActiveFlowStep(flow);
    return {
        ...flow.state,
        ...(flow.value.trim().length > 0 ? { [currentStep.key]: flow.value } : {})
    };
}
