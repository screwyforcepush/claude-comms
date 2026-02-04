import * as react_jsx_runtime from 'react/jsx-runtime';

/**
 * Type definitions for feedback widget package
 *
 * These types support both Storybook and universal app contexts
 */
/**
 * Convex storage ID type (string)
 * Standalone type to avoid dependency on Convex generated types
 */
type ConvexStorageId = string;
/**
 * Convex document ID type (string)
 * Standalone type to avoid dependency on Convex generated types
 */
type ConvexDocumentId = string;
/**
 * Feedback status states
 * 5-state model for MCP integration
 */
type FeedbackStatus = 'pending' | 'active' | 'review' | 'resolved' | 'rejected';
/**
 * Feedback priority levels
 */
type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';
/**
 * Viewport dimensions
 */
interface Viewport {
    width: number;
    height: number;
}
/**
 * Context metadata for feedback submissions
 * All fields optional for backward compatibility with Storybook
 */
interface FeedbackMetadata {
    /** App route (e.g., "/dashboard") - for universal apps */
    route?: string;
    /** Storybook story path (e.g., "button--primary") - for Storybook */
    path?: string;
    /** Git SHA or version tag */
    releaseId?: string;
    /** Environment: "staging" | "dev" | "review" | "storybook" | "production" */
    env?: string;
    /** K-anonymized user identifier (SHA256) */
    userHash?: string;
    /** Active feature flags */
    flags?: string[];
    /** Project identifier (e.g., "acme-webapp" | "storybook") */
    project?: string;
}
/**
 * Complete feedback submission data
 */
interface FeedbackSubmission {
    /** Full page URL */
    url: string;
    /** User-provided note/description */
    note?: string;
    /** Excalidraw scene elements as JSON string */
    overlayJSON: string;
    /** Convex storage ID for screenshot */
    screenshot: ConvexStorageId;
    /** User agent string */
    ua: string;
    /** Viewport dimensions at capture time */
    viewport: Viewport;
    /** Context metadata */
    metadata: FeedbackMetadata;
}
/**
 * Feedback record from database (with additional fields)
 */
interface FeedbackRecord extends FeedbackSubmission {
    /** Convex document ID */
    _id: ConvexDocumentId;
    /** Creation timestamp (Unix ms) */
    createdAt: number;
    /** Current status */
    status: FeedbackStatus;
    /** Priority level */
    priority?: FeedbackPriority;
    /** Assigned developer/team */
    assignedTo?: string;
    /** Last update timestamp */
    updatedAt?: number;
    /** Resolution timestamp */
    resolvedAt?: number;
    /** Screenshot URL (signed, temporary) */
    screenshotUrl?: string;
}
/**
 * Props for FeedbackOverlayManager
 */
interface FeedbackOverlayManagerProps {
    /** Whether the overlay should be visible */
    enabled: boolean;
    /** Callback when user closes the overlay */
    onClose: () => void;
    /** Callback to toggle overlay visibility */
    onToggle: () => void;
    /** Show floating toggle button */
    showButton?: boolean;
    /** Context metadata to include with submission */
    metadata?: FeedbackMetadata;
    /** Convex URL for backend connection */
    convexUrl: string;
}
/**
 * Props for FeedbackOverlay component
 */
interface FeedbackOverlayProps {
    /** Callback to close/hide the overlay */
    onClose: () => void;
    /** Context metadata to include with submission */
    metadata?: FeedbackMetadata;
}
/**
 * Toast notification type
 */
interface ToastMessage {
    message: string;
    type: 'success' | 'error';
}
/**
 * Excalidraw toolbar position
 */
type ToolbarPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
/**
 * Context callback return type
 * Provides dynamic metadata to enrich feedback submissions
 *
 * @example
 * ```tsx
 * getContext: () => ({
 *   releaseId: process.env.NEXT_PUBLIC_RELEASE_ID,
 *   env: process.env.NEXT_PUBLIC_ENV,
 *   flags: getActiveFeatureFlags(),
 * })
 * ```
 */
type FeedbackContext = Partial<Omit<FeedbackMetadata, 'route' | 'path'>>;
/**
 * Props for FeedbackProvider component
 * Top-level wrapper that manages feedback widget lifecycle
 *
 * @example
 * ```tsx
 * <FeedbackProvider
 *   convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
 *   project="acme-webapp"
 *   enabled={process.env.NODE_ENV !== 'production'}
 *   hotkey="Alt+F"
 *   getContext={() => ({
 *     releaseId: process.env.NEXT_PUBLIC_RELEASE_ID,
 *     env: process.env.NEXT_PUBLIC_ENV,
 *   })}
 * >
 *   {children}
 * </FeedbackProvider>
 * ```
 */
interface FeedbackProviderProps {
    /** Convex deployment URL for backend connection */
    convexUrl: string;
    /** Project identifier (e.g., "acme-webapp", "storybook") */
    project: string;
    /** Enable/disable widget based on environment (e.g., disabled in production) */
    enabled: boolean;
    /** Keyboard shortcut to toggle widget (default: "Alt+F") */
    hotkey?: string;
    /** Show floating toggle button (default: false) */
    showButton?: boolean;
    /** Dynamic context provider callback - called on each submission */
    getContext?: () => FeedbackContext;
    /** Child components */
    children: React.ReactNode;
}
/**
 * Screenshot capture configuration options
 * Controls quality and rendering of feedback screenshots
 *
 * Uses html-to-image library which provides superior CSS rendering accuracy
 * compared to html2canvas, especially for fixed-position overlays and modern layouts.
 *
 * @see https://github.com/bubkoo/html-to-image for detailed option descriptions
 */
interface ScreenshotOptions {
    /** Pixel ratio for screenshot resolution (default: 1, use 2 for retina displays) */
    pixelRatio?: number;
    /** Image quality for PNG compression (default: 0.92, range: 0-1) */
    quality?: number;
    /** Background color for transparent elements (default: null for transparent) */
    backgroundColor?: string | null;
}

/**
 * FeedbackProvider Component
 *
 * Wraps your application to provide feedback widget functionality.
 * Handles hotkey shortcuts, metadata gathering, and environment gating.
 *
 * @param props - FeedbackProviderProps
 * @returns React component wrapping children with feedback functionality
 */
declare function FeedbackProvider({ convexUrl, project, enabled, hotkey, showButton, getContext, children, }: FeedbackProviderProps): react_jsx_runtime.JSX.Element;

/**
 * FeedbackOverlay Component
 *
 * Renders a full-screen overlay with Excalidraw annotations, note input,
 * and screenshot submission workflow.
 */
declare function FeedbackOverlay({ onClose, metadata }: FeedbackOverlayProps): react_jsx_runtime.JSX.Element;

/**
 * Universal Feedback Overlay Manager
 *
 * This component manages the FeedbackOverlay lifecycle independently of navigation/routing.
 * It prevents the overlay from being unmounted/remounted when users navigate between routes,
 * which prevents flicker and network request cancellations.
 *
 * Key behavior:
 * - Renders to a stable root outside React's tree (portal pattern)
 * - Uses DOM manipulation to show/hide overlay
 * - Persists overlay instance across route navigations
 * - Framework-agnostic event-based communication
 *
 * Enhancements from Storybook version:
 * - Accepts metadata prop for route/release/env/flags context
 * - Environment gating (enabled prop controls availability)
 * - No Storybook-specific dependencies
 * - Uses type imports from ./types
 *
 * Architecture:
 * - Singleton pattern: One ConvexProvider instance across app lifecycle
 * - Portal rendering: Overlay mounts to document.body, escapes all container constraints
 * - Event-driven: Custom events decouple manager from overlay lifecycle
 */

/**
 * FeedbackOverlayManager Component
 *
 * Manager component that controls overlay via imperative DOM manipulation.
 * This approach keeps the overlay mounted and just toggles visibility via events.
 *
 * Props:
 * - enabled: Whether the overlay should be visible
 * - onClose: Callback when user closes the overlay
 * - metadata: Context metadata (route, releaseId, env, flags, project)
 * - convexUrl: Convex backend URL
 *
 * Usage:
 * ```tsx
 * <FeedbackOverlayManager
 *   enabled={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   metadata={{
 *     route: '/dashboard',
 *     releaseId: process.env.NEXT_PUBLIC_RELEASE_ID,
 *     env: 'staging',
 *     project: 'acme-webapp'
 *   }}
 *   convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL}
 * />
 * ```
 */
declare function FeedbackOverlayManager({ enabled, onClose, onToggle, metadata, convexUrl, showButton, }: FeedbackOverlayManagerProps): null;

/**
 * Screenshot capture utilities using html-to-image
 *
 * Provides framework-agnostic screenshot capture with:
 * - Accurate CSS rendering (better than html2canvas)
 * - Improved fixed-position element support
 * - Configurable pixel ratio/quality
 * - PII redaction integration
 * - CORS handling for cross-origin images
 *
 * @module utils/screenshot
 */

/**
 * Capture a screenshot of the current viewport using html-to-image.
 * Assumes callers manage UI hiding/redaction before invoking.
 *
 * html-to-image provides superior rendering accuracy compared to html2canvas,
 * especially for fixed-position overlays, CSS transforms, and modern layouts.
 *
 * This function constrains capture to the visible viewport, not the full scrollable page.
 */
declare function captureScreenshot(targetElement?: HTMLElement, options?: ScreenshotOptions): Promise<Blob>;
/**
 * Default screenshot options
 * pixelRatio=1 balances quality vs file size (~90KB at typical viewport)
 * Use pixelRatio=2 for retina/high-DPI displays
 */
declare const DEFAULT_SCREENSHOT_OPTIONS: ScreenshotOptions;

/**
 * PII (Personally Identifiable Information) redaction utilities
 *
 * Automatically detects and blurs sensitive form fields before screenshot capture
 * to prevent accidental exposure of user data in feedback submissions.
 *
 * Redaction strategies:
 * - Password fields (type="password")
 * - Credit card fields (autocomplete="cc-*")
 * - SSN/Tax ID fields (data-sensitive attribute)
 * - Custom exclusions (data-no-capture attribute)
 *
 * @module utils/pii-redaction
 */
/**
 * Apply visual redaction to sensitive fields
 *
 * This function will:
 * 1. Query DOM for sensitive field selectors
 * 2. Apply blur CSS filter via class
 * 3. Return cleanup function to restore original state
 *
 * @returns Cleanup function to remove redaction
 *
 * @example
 * ```tsx
 * const restore = applyPIIRedaction();
 * await captureScreenshot();
 * restore(); // Remove blur effects
 * ```
 */
declare function applyPIIRedaction(): () => void;
/**
 * Selectors for fields that should be redacted
 * Matches password fields, credit card inputs, and explicitly marked sensitive data
 */
declare const SENSITIVE_FIELD_SELECTORS: readonly ["input[type=\"password\"]", "input[autocomplete^=\"cc-\"]", "input[autocomplete=\"current-password\"]", "input[autocomplete=\"new-password\"]", "[data-sensitive=\"true\"]", "[data-no-capture=\"true\"]", ".sensitive-data"];

/**
 * Metadata gathering utilities
 *
 * Captures context information about the environment, release, and user
 * to enrich feedback submissions with actionable details.
 *
 * Metadata includes:
 * - Current route/path
 * - Release ID (git SHA or version tag)
 * - Environment (dev, staging, production)
 * - Active feature flags
 * - Anonymized user identifier
 * - Viewport dimensions
 * - User agent
 *
 * @module utils/metadata
 */

/**
 * Gather viewport dimensions
 *
 * @returns Current viewport width and height
 */
declare function getViewportDimensions(): Viewport;
/**
 * Get user agent string
 *
 * @returns Browser user agent
 */
declare function getUserAgent(): string;
/**
 * Generate anonymized user hash
 *
 * This function will implement k-anonymization using SHA256
 * to create a privacy-preserving user identifier.
 *
 * @param userId - Original user identifier
 * @returns SHA256 hash of user ID (or undefined if not available)
 */
declare function generateUserHash(userId?: string): string | undefined;
/**
 * Gather all available metadata
 *
 * Combines environment variables, URL context, and dynamic values
 * into a complete metadata object for feedback submission.
 *
 * @param additionalContext - Additional context from provider
 * @returns Complete feedback metadata
 */
declare function gatherMetadata(additionalContext?: Partial<FeedbackMetadata>): FeedbackMetadata;

export { DEFAULT_SCREENSHOT_OPTIONS, type FeedbackContext, type FeedbackMetadata, FeedbackOverlay, FeedbackOverlayManager, type FeedbackOverlayManagerProps, type FeedbackOverlayProps, type FeedbackPriority, FeedbackProvider, type FeedbackProviderProps, type FeedbackRecord, type FeedbackStatus, type FeedbackSubmission, SENSITIVE_FIELD_SELECTORS, type ScreenshotOptions, type ToastMessage, type ToolbarPosition, type Viewport, applyPIIRedaction, captureScreenshot, gatherMetadata, generateUserHash, getUserAgent, getViewportDimensions };
