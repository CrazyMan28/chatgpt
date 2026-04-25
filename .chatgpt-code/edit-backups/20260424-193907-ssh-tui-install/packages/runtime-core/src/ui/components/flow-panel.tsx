import { useRef } from "react";

import { Box, Spacer, Text, useInput } from "ink";

import {
  formatFlowStepLabel,
  getActiveFlowStep,
  getFlowOptions,
  resolveFlowDescription,
  resolveFlowTitle,
  type FlowState
} from "../flow-engine.js";
import { uiTheme } from "../theme.js";
import { Panel } from "./panel.js";

export interface FlowPanelProps {
  flow: FlowState;
  height: number;
  width: number;
  onCancel: () => void;
  onMoveSelection: (direction: "next" | "previous") => void;
  onSubmitSelection: () => void;
}

export function FlowPanel({
  flow,
  height,
  width,
  onCancel,
  onMoveSelection,
  onSubmitSelection
}: FlowPanelProps): React.JSX.Element {
  const step = getActiveFlowStep(flow);
  const options = getFlowOptions(flow);
  const isSelectable = step.inputType !== "text";
  const cancelBufferRef = useRef("");

  useInput((input, key) => {
    if ((input === "c" && key.ctrl) || key.escape || input === "\u001b") {
      cancelBufferRef.current = "";
      onCancel();
      return;
    }

    if (input === "/" || cancelBufferRef.current.length > 0) {
      if (input === "/" && cancelBufferRef.current.length === 0) {
        cancelBufferRef.current = "/";
        return;
      }

      if (key.backspace || key.delete) {
        cancelBufferRef.current = cancelBufferRef.current.slice(0, -1);
        return;
      }

      if (key.return) {
        cancelBufferRef.current = "";
        return;
      }

      if (input.length === 1) {
        const nextValue = `${cancelBufferRef.current}${input}`;

        if ("/cancel".startsWith(nextValue)) {
          cancelBufferRef.current = nextValue;

          if (nextValue === "/cancel") {
            cancelBufferRef.current = "";
            onCancel();
          }
        } else {
          cancelBufferRef.current = "";
        }
      }

      return;
    }

    if (!isSelectable) {
      return;
    }

    if (key.upArrow || key.leftArrow) {
      onMoveSelection("previous");
      return;
    }

    if (key.downArrow || key.rightArrow || key.tab) {
      onMoveSelection("next");
      return;
    }

    if (key.return) {
      onSubmitSelection();
    }
  });

  return (
    <Panel
      footer={
        step.inputType === "text"
          ? "Type a value below and press Enter • /cancel exits this flow"
          : "Use arrows to choose • Enter confirms • /cancel exits this flow"
      }
      height={height}
      subtitle={formatFlowStepLabel(flow)}
      title={flow.id}
      width={width}
    >
      <Box flexDirection="column">
        <Text bold color={uiTheme.colors.accent}>
          {resolveFlowTitle(flow)}
        </Text>
        <Text color={uiTheme.colors.muted}>{resolveFlowDescription(flow)}</Text>
        <Text color={uiTheme.colors.muted}> </Text>
        {step.inputType === "text" ? (
          <Text color={uiTheme.colors.text}>
            {flow.value.trim().length > 0 ? flow.value : "Waiting for input…"}
          </Text>
        ) : (
          options.map((option) => {
            const isSelected = option.value === flow.value;

            return (
              <Box key={`${flow.id}:${step.key}:${option.value}`}>
                <Text color={isSelected ? uiTheme.colors.accent : uiTheme.colors.text}>
                  {isSelected ? "> " : "  "}
                  {option.label}
                </Text>
                <Spacer />
                {option.description ? (
                  <Text color={uiTheme.colors.muted}>{option.description}</Text>
                ) : null}
              </Box>
            );
          })
        )}
      </Box>
    </Panel>
  );
}
