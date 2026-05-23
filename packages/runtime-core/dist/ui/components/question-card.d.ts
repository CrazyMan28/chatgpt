import * as React from "react";
import { Component, type ReactNode } from "react";
import { type QuestionRow } from "../questions.js";
import type { Question, TuiThemeName } from "../types.js";
export interface QuestionCardProps {
    customValue: string;
    error?: string;
    height: number;
    progressLabel?: string;
    question: Question;
    selectedIndex: number;
    selectedOptionIds: readonly string[];
    themeName: TuiThemeName;
    width: number;
}
export interface QuestionCardBoundaryProps {
    children: ReactNode;
    onError?: (error: unknown) => void;
    resetKey?: string;
}
interface QuestionCardBoundaryState {
    failed: boolean;
}
export declare class QuestionCardBoundary extends Component<QuestionCardBoundaryProps, QuestionCardBoundaryState> {
    state: QuestionCardBoundaryState;
    static getDerivedStateFromError(): QuestionCardBoundaryState;
    componentDidCatch(error: unknown): void;
    componentDidUpdate(previousProps: QuestionCardBoundaryProps): void;
    render(): ReactNode;
}
export declare function QuestionQueue({ children, height, themeName, width }: {
    children: ReactNode;
    height: number;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function QuestionCard({ customValue, error, height, progressLabel, question, selectedIndex, selectedOptionIds, themeName, width }: QuestionCardProps): React.JSX.Element;
export declare function QuestionOption({ customValue, index, isSelected, isToggled, row, themeName, width }: {
    customValue: string;
    index: number;
    isSelected: boolean;
    isToggled: boolean;
    row: QuestionRow;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function QuestionInput({ themeName, width }: {
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export {};
//# sourceMappingURL=question-card.d.ts.map