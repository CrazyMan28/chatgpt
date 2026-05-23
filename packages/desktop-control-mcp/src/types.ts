export type DesktopMode = "readonly" | "assistive" | "approve" | "autopilot";
export type DesktopRisk = "safe" | "medium" | "dangerous";
export type VisionProviderName = "mistral" | "ollama" | "local";

export interface Bounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface DesktopEnvironment {
  availableCommands: string[];
  desktopSession?: string;
  display?: string;
  platform: NodeJS.Platform;
  waylandDisplay?: string;
  xdgCurrentDesktop?: string;
  xdgSessionType?: string;
}

export interface ScreenshotResult {
  activeWindow?: WindowInfo;
  capturedAt: number;
  command?: string;
  environment: DesktopEnvironment;
  height?: number;
  mimeType: "image/png";
  path: string;
  sizeBytes: number;
  width?: number;
}

export interface WindowInfo {
  app?: string;
  bounds?: Bounds;
  id: string;
  isActive?: boolean;
  pid?: number;
  title: string;
}

export interface DesktopElement {
  actions: string[];
  app?: string;
  bounds?: Bounds;
  children?: DesktopElement[];
  description?: string;
  id: string;
  name?: string;
  role?: string;
  states: string[];
  value?: string;
}

export interface AccessibilityResult {
  available: boolean;
  error?: string;
  focused?: DesktopElement;
  generatedAt: number;
  root?: DesktopElement;
  summary: string;
}

export interface DesktopCapabilityStatus {
  available: boolean;
  detail?: string;
}

export interface DesktopCapabilities {
  accessibility: DesktopCapabilityStatus;
  appControl: DesktopCapabilityStatus;
  inputControl: DesktopCapabilityStatus;
  screenshot: DesktopCapabilityStatus;
  windowControl: DesktopCapabilityStatus;
}

export interface DesktopObservation {
  accessibility?: AccessibilityResult;
  activeWindow?: WindowInfo;
  environment: DesktopEnvironment;
  screenshot?: ScreenshotResult;
  summary: string;
  timestamp: number;
  windows: WindowInfo[];
}

export interface VisionElement {
  approx_box?: [number, number, number, number];
  confidence: number;
  label: string;
  reason?: string;
  type: "button" | "text_field" | "menu" | "link" | "unknown";
}

export interface VisionSuggestedAction {
  confidence: number;
  reason?: string;
  target?: string;
  text?: string;
  type: "click" | "type" | "scroll" | "wait" | "keypress";
  x?: number;
  y?: number;
}

export interface VisionObservation {
  screen_summary: string;
  suggested_actions: VisionSuggestedAction[];
  visible_elements: VisionElement[];
  visible_windows: string[];
}

export interface DesktopActionTarget {
  app?: string;
  elementId?: string;
  kind: "accessibility" | "coordinate" | "app" | "window" | "browser";
  selector?: string;
  windowId?: string;
  x?: number;
  y?: number;
}

export interface DesktopAction {
  confidence?: number;
  keys?: string[];
  reason?: string;
  target?: DesktopActionTarget;
  text?: string;
  type:
    | "click"
    | "type"
    | "keypress"
    | "scroll"
    | "drag"
    | "wait"
    | "screenshot"
    | "focus"
    | "open_app";
  x2?: number;
  y2?: number;
}

export interface DesktopActionResult {
  action?: DesktopAction;
  approvalId?: string;
  executed: boolean;
  method?: "app" | "accessibility" | "mouse_keyboard" | "browser" | "none";
  ok: boolean;
  reason?: string;
  risk: DesktopRisk;
  result?: unknown;
}

export interface DesktopConfig {
  allowedApps: string[];
  blockedApps: string[];
  mode: DesktopMode;
  useAccessibilityFirst: boolean;
  visionFallback: boolean;
  visionModel?: string;
  visionProvider: VisionProviderName;
}

export interface DesktopStatus {
  activeWatcher?: DesktopWatcherRecord;
  capabilities?: DesktopCapabilities;
  config: DesktopConfig;
  coreEnabled?: boolean;
  environment?: DesktopEnvironment;
  lastAction?: DesktopActionResult;
  lastObservation?: DesktopObservation;
  lastScreenshotAt?: number;
  pendingApproval?: {
    action: DesktopAction;
    id?: string;
    reason: string;
    risk: DesktopRisk;
  };
  vision: VisionStatus;
}

export interface DesktopWatcherRecord {
  currentApp?: string;
  currentWindow?: string;
  id: string;
  lastObservationSummary?: string;
  lastProgressTime: number;
  lastScreenshotTimestamp?: number;
  state: "active" | "healthy" | "stalled" | "completed" | "failed" | "cancelled";
  stopReason?: string;
  taskId?: string;
  taskSummary: string;
}

export interface VisionStatus {
  availableModels?: string[];
  baseUrl?: string;
  configured: boolean;
  model?: string;
  provider: VisionProviderName;
  reason?: string;
  supportsVision: boolean | "unknown";
}

export interface DesktopVisionAuth {
  localBaseUrl?: string;
  localModel?: string;
  mistralApiKey?: string;
  mistralBaseUrl?: string;
  mistralModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export interface DesktopApprovalRequest {
  action: DesktopAction;
  detail: string;
  resource?: string;
  risk: DesktopRisk;
  summary: string;
}

export interface DesktopApprovalDecision {
  approved: boolean;
  id?: string;
  reason?: string;
}

export interface DesktopControllerOptions {
  approvalHandler?: (
    request: DesktopApprovalRequest
  ) => Promise<DesktopApprovalDecision>;
  getVisionAuth?: () => DesktopVisionAuth | undefined;
  now?: () => number;
  statePath?: string;
}
