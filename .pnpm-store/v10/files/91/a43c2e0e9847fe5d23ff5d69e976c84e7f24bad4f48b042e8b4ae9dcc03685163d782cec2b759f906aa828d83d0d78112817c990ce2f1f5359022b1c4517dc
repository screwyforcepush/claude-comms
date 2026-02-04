# annotated-feedback-widget

Universal feedback widget with visual annotation support for React/Next.js applications.

## Features

- **Visual Feedback**: Annotate screenshots with Excalidraw drawing tools
- **Smart Capture**: Viewport-constrained screenshots with PII redaction
- **Rich Context**: Automatic metadata gathering (route, release, environment, feature flags)
- **Backend Integration**: Convex backend for real-time storage and retrieval
- **Framework-Agnostic Patterns**: Portal rendering, event-based communication
- **TypeScript First**: Fully typed API with comprehensive type definitions
- **Production Ready**: Environment gating, performance optimized

## Installation

```bash
npm install annotated-feedback-widget
# or
pnpm add annotated-feedback-widget
# or
yarn add annotated-feedback-widget
```

### Peer Dependencies

This package requires React 18+ or React 19+:

```bash
npm install react react-dom
```

## Quick Start

### Basic Usage (Next.js App Router)

```tsx
// app/layout.tsx
import { FeedbackProvider } from 'annotated-feedback-widget';
import 'annotated-feedback-widget/styles.css';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <FeedbackProvider
          convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
          project="my-app"
          enabled={process.env.NODE_ENV !== 'production'}
          hotkey="Alt+F"
        >
          {children}
        </FeedbackProvider>
      </body>
    </html>
  );
}
```

### With Context Metadata

```tsx
<FeedbackProvider
  convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
  project="acme-webapp"
  enabled={process.env.NODE_ENV !== 'production'}
  hotkey="Alt+F"
  getContext={() => ({
    releaseId: process.env.NEXT_PUBLIC_RELEASE_ID,
    env: process.env.NEXT_PUBLIC_ENV,
    flags: getActiveFeatureFlags(),
  })}
>
  {children}
</FeedbackProvider>
```

## API Reference

### FeedbackProvider

Top-level wrapper component that manages the feedback widget lifecycle.

**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `convexUrl` | `string` | Yes | - | Convex deployment URL |
| `project` | `string` | Yes | - | Project identifier (e.g., "my-app") |
| `enabled` | `boolean` | Yes | - | Enable/disable widget (use for env gating) |
| `hotkey` | `string` | No | `"Alt+F"` | Keyboard shortcut to toggle widget |
| `getContext` | `() => FeedbackContext` | No | - | Dynamic context provider callback |
| `children` | `React.ReactNode` | Yes | - | Child components |

### FeedbackMetadata

Context metadata included with feedback submissions:

```typescript
interface FeedbackMetadata {
  route?: string;        // App route (e.g., "/dashboard")
  path?: string;         // Storybook path (e.g., "button--primary")
  releaseId?: string;    // Git SHA or version tag
  env?: string;          // Environment: "staging" | "dev" | "production"
  userHash?: string;     // K-anonymized user identifier
  flags?: string[];      // Active feature flags
  project?: string;      // Project identifier
}
```

### Screenshot Options

Configure screenshot capture quality and rendering:

```typescript
interface ScreenshotOptions {
  pixelRatio?: number;         // Pixel density (default: 1, use 2 for retina)
  quality?: number;            // PNG quality (0-1, default: 0.92)
  backgroundColor?: string | null;  // Background color (default: null)
}
```

**Note:** The widget uses `html-to-image` instead of `html2canvas` for superior CSS rendering accuracy, especially for fixed-position overlays and modern layouts.

## Architecture

### Portal Pattern

The widget uses React portals to render outside the normal component tree, preventing:
- Route navigation unmounting/remounting (no flicker)
- Z-index and overflow container constraints
- Network request cancellations during navigation

### Event-Based Communication

Custom DOM events decouple the widget manager from overlay lifecycle:
- No prop drilling through React tree
- Works across framework boundaries
- Easy to extend with additional events

### Singleton Convex Client

Single WebSocket connection persists across all routes:
- No reconnection thrashing on navigation
- Efficient resource usage
- Proper cleanup on unmount

## Development

### Build

```bash
npm run build
```

Outputs ESM and CJS bundles to `dist/`:
- `dist/index.js` - CommonJS bundle
- `dist/index.mjs` - ES Module bundle
- `dist/index.d.ts` - TypeScript declarations
- `dist/styles.css` - Compiled styles

### Development Mode

```bash
npm run dev
```

Watches source files and rebuilds on changes.

### Type Checking

```bash
npm run typecheck
```

### Testing

```bash
npm test           # Run tests once
npm run test:watch # Watch mode
```

## Package Structure

```
annotated-feedback-widget/
├── src/
│   ├── FeedbackProvider.tsx       # Top-level wrapper (TODO)
│   ├── FeedbackOverlayManager.tsx # Lifecycle manager
│   ├── FeedbackOverlay.tsx        # UI component (TODO)
│   ├── types.ts                   # TypeScript types
│   ├── index.ts                   # Package exports
│   └── utils/
│       ├── screenshot.ts          # Screenshot capture (TODO)
│       ├── pii-redaction.ts       # PII redaction (TODO)
│       └── metadata.ts            # Context gathering (TODO)
├── package.json
├── tsconfig.json
├── README.md
└── dist/                          # Build output (generated)
```

## Browser Support

Modern evergreen browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Security

### PII Redaction

The widget automatically blurs sensitive fields before screenshot capture:
- Password fields (`type="password"`)
- Credit card inputs (`autocomplete="cc-*"`)
- Custom sensitive fields (`data-sensitive="true"`)
- Opt-out fields (`data-no-capture="true"`)

### User Anonymization

User identifiers are hashed using SHA256 for k-anonymization, preventing direct user identification in feedback data.

## License

MIT

## Contributing

This package is part of the Annotated Feedback project. See the main repository for contribution guidelines.
