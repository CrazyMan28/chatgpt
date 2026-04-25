export interface InputBarProps {
    footer?: string;
    focusInput?: boolean;
    isBusy: boolean;
    isStreaming: boolean;
    mask?: string;
    onChange: (value: string) => void;
    onSubmit: (value: string) => void;
    placeholder?: string;
    subtitle?: string;
    title?: string;
    value: string;
    width: number;
}
export declare function InputBar({ footer, focusInput, isBusy, isStreaming, mask, onChange, onSubmit, placeholder, subtitle, title, value, width }: InputBarProps): React.JSX.Element;
//# sourceMappingURL=input-bar.d.ts.map