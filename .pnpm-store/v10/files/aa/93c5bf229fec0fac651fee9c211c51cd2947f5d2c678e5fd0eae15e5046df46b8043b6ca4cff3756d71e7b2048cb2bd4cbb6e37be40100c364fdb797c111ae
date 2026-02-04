# Annotated Feedback

Universal feedback widget with visual annotations, powered by Convex.

## Components

This package provides three integrated components:

1. **Convex Backend** (`convex/`) - Database and API for feedback collection
2. **React Widget** (`widget/`) - Frontend component for capturing feedback
3. **MCP Server** (`mcp/`) - Model Context Protocol server for AI agents

## Setup

### Prerequisites

- Convex account (sign up at https://convex.dev)
- Node.js 20+
- pnpm (or npm/yarn)

### Creating a New Convex Project

**IMPORTANT:** This package requires its own isolated Convex project.

#### Option 1: Manual Setup (Recommended for first-time setup)

1. Go to https://dashboard.convex.dev
2. Create a new project: "annotated-feedback"
3. Get your deployment URL (e.g., `https://your-deployment.convex.cloud`)
4. Create a `.env.local` file in this directory:
   ```bash
   CONVEX_DEPLOYMENT=prod:your-deployment-name
   CONVEX_URL=https://your-deployment.convex.cloud
   ```

#### Option 2: CLI Setup (Interactive)

```bash
npx convex init
# Choose "Create new project"
# Name it "annotated-feedback"
```

### Deploying the Backend

```bash
# Deploy to production
pnpm convex:deploy

# Or start development mode
pnpm convex:dev
```

### Using the Widget

```bash
npm install annotated-feedback
```


```tsx
import { FeedbackProvider } from 'annotated-feedback/widget'
import 'annotated-feedback/widget/styles'

function App() {
  return (
    <FeedbackProvider
      convexUrl="https://your-deployment.convex.cloud"
      project="my-app"
      enabled={process.env.NODE_ENV !== 'production'}
      hotkey="Alt+F"
    >
      {/* your app */}
    </FeedbackProvider>
  )
}
```

#### Next.js (App Router) SSR Notes

The widget depends on Excalidraw, which references `window`/`navigator` during module evaluation. When a Next.js App Router layout imports `FeedbackProvider` directly, the server render path throws `ReferenceError: navigator is not defined`.

Work around this by:

1. Wrapping the integration in a client component.
2. Dynamically importing the widget on the client (e.g. inside `useEffect` or via `next/dynamic({ ssr: false })`).

Example pattern:

```tsx
"use client";
import { useEffect, useState } from "react";

export function FeedbackWidgetProvider({ children }) {
  const [FeedbackProvider, setFeedbackProvider] = useState(null);

  useEffect(() => {
    import("annotated-feedback/widget").then((mod) => {
      setFeedbackProvider(() => mod.FeedbackProvider);
    });
  }, []);

  return (
    <>
      {children}
      {FeedbackProvider ? (
        <FeedbackProvider
          convexUrl={process.env.NEXT_PUBLIC_FEEDBACK_CONVEX_URL!}
          project="my-app"
          enabled
          showButton
        />
      ) : null}
    </>
  );
}
```

This keeps the widget disabled during SSR, then hydrates the overlay once the browser environment is available.

### Using the MCP Server

```bash
claude mcp add annotated-feedback --scope user -- \
  env CONVEX_URL="https://your-deployment.convex.cloud" \
  PROJECT="my-app" \
  npx -y annotated-feedback
```

## Development

See individual package READMEs:
- Widget: `widget/README.md`
- MCP: `mcp/README.md`

## Architecture

This package uses a **shared Convex backend** model:
- Multiple apps can submit feedback to one central deployment
- Apps are distinguished by the `project` field
- MCP server can be scoped to one project via `PROJECT` env var

## License

MIT
