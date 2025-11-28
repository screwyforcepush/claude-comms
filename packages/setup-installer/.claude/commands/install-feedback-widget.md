# Install Annotated Feedback Widget

Guide the user through installing the `annotated-feedback` widget in their application. This widget provides visual feedback annotation capabilities with screenshot capture and Convex backend integration.

## ⚠️ PREREQUISITES - MUST COMPLETE BEFORE STARTING

**STOP! Before proceeding, ask the user:**

1. **Do you have a Convex deployment URL?**
   - Format: `https://xxx-xxx-123.convex.cloud`
   - If NO: Guide them to create one at https://dashboard.convex.dev
   - They MUST provide this URL before installation can proceed

2. **What is your project name?**
   - If not provided: Use the current repository name as the default
   - Command to get repo name: `basename $(git rev-parse --show-toplevel 2>/dev/null) || basename $PWD`
   - This will be used as the namespace for feedback submissions

**DO NOT PROCEED** until you have:
- ✅ Convex deployment URL (verified format)
- ✅ Project name (user-provided or auto-detected from repo)

---

## CRITICAL CONTEXT

**Package Details:**
- NPM Package: `annotated-feedback` (NOT `annotated-feedback-widget`)
- **Minimum Version: 0.1.24+** (earlier versions have SSR/Convex context issues)
- Import Paths:
  - Components: `annotated-feedback/widget`
  - Styles: `annotated-feedback/widget/styles`
- Framework: React-based (requires React 18+ as peer dependency)
- Backend: Convex (user provides deployment URL)

**What This Widget Does:**
- Provides a floating feedback button and hotkey (default: Alt+F)
- Opens an overlay with Excalidraw drawing tools
- Captures viewport screenshots with PII redaction
- Submits annotated feedback to Convex backend
- Includes metadata: route, environment, project name, feature flags

**Dependencies Included (v0.1.24+):**
- `@excalidraw/excalidraw` - Drawing canvas (dynamically imported, client-side only)
- `convex` - Backend client (externalized)
- `html-to-image` - Screenshot capture
- All are automatically installed as transitive dependencies
- **SSR Compatible**: Excalidraw loads asynchronously after page hydration

**Key Improvements in v0.1.24:**
- ✅ Next.js SSR compatible (dynamic Excalidraw import)
- ✅ No font file errors (stripped from bundled CSS)
- ✅ Isolated Convex context (doesn't override parent app's Convex)
- ✅ Properly externalized React (no "Invalid hook call" errors)

---

## INSTALLATION PROCESS

### Step 1: Detect Framework

Ask the user:
1. What framework are they using? (React, Next.js, Vue, Svelte, vanilla JS, etc.)
2. What bundler? (Vite, Webpack, etc.)
3. Do they have a Convex deployment URL? (If not, guide them to create one at https://dashboard.convex.dev)

### Step 2: Install Dependencies

**For ALL frameworks:**

```bash
# Install the widget package
pnpm add annotated-feedback
# or
npm install annotated-feedback
# or
yarn add annotated-feedback
```

**For React/Next.js:**
- React 18+ should already be installed (peer dependency)
- No additional deps needed

**For Non-React frameworks (Vue, Svelte, vanilla JS):**

```bash
# Install React as peer dependency
pnpm add react react-dom
```

**TypeScript Projects:**

```bash
# Install type definitions
pnpm add -D @types/react @types/react-dom
```

---

## FRAMEWORK-SPECIFIC INTEGRATION

### React / Next.js App Router

**File: `app/layout.tsx` (or root layout)**

```tsx
import { FeedbackProvider } from 'annotated-feedback/widget';
import 'annotated-feedback/widget/styles';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <FeedbackProvider
          convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
          project="your-project-name"
          enabled={process.env.NODE_ENV !== 'production'}
          hotkey="Alt+F"
          showButton={true}
          getContext={() => ({
            route: window.location.pathname,
            env: process.env.NODE_ENV,
            releaseId: process.env.NEXT_PUBLIC_RELEASE_ID,
          })}
        >
          {children}
        </FeedbackProvider>
      </body>
    </html>
  );
}
```

**Environment Variables (`.env.local`):**

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

---

### Vue 3 (Vite)

**CRITICAL: Vue requires special configuration to handle React widget**

#### Step 2.1: Install Vite React Plugin

```bash
pnpm add -D @vitejs/plugin-react
```

#### Step 2.2: Update `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    react() // Enable React support for widget
  ],
  resolve: {
    // Dedupe React to prevent multiple instances (CRITICAL!)
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: {
      // Force all React imports to use the same instance
      'react': path.resolve(__dirname, 'node_modules/.pnpm/react@18.3.1/node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/.pnpm/react@18.3.1/node_modules/react/jsx-runtime'),
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime']
  }
})
```

**IMPORTANT:** Adjust the version numbers in the alias paths to match the installed React version (check `node_modules/.pnpm/`).

#### Step 2.3: Create Vue Wrapper Component

**File: `src/components/FeedbackWidget.vue`**

```vue
<template>
  <div ref="feedbackContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { FeedbackProvider } from 'annotated-feedback/widget';
import 'annotated-feedback/widget/styles';

const props = defineProps<{
  convexUrl: string;
  project: string;
  enabled?: boolean;
  hotkey?: string;
  showButton?: boolean;
}>();

const feedbackContainer = ref<HTMLDivElement | null>(null);
let reactRoot: Root | null = null;

onMounted(() => {
  if (!feedbackContainer.value) return;

  reactRoot = createRoot(feedbackContainer.value);

  reactRoot.render(
    React.createElement(
      FeedbackProvider,
      {
        convexUrl: props.convexUrl,
        project: props.project,
        enabled: props.enabled ?? true,
        hotkey: props.hotkey ?? 'Alt+F',
        showButton: props.showButton ?? false,
        getContext: () => ({
          route: window.location.pathname,
          url: window.location.href,
          env: import.meta.env.MODE,
        }),
        children: React.createElement(React.Fragment, null)
      }
    )
  );
});

onBeforeUnmount(() => {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
});
</script>
```

#### Step 2.4: Integrate in App

**File: `src/App.vue`**

```vue
<template>
  <div>
    <!-- Your app content -->

    <!-- Feedback Widget -->
    <FeedbackWidget
      v-if="feedbackEnabled"
      :convex-url="convexUrl"
      project="your-project-name"
      :enabled="true"
      hotkey="Alt+F"
      :show-button="true"
    />
  </div>
</template>

<script setup lang="ts">
import FeedbackWidget from './components/FeedbackWidget.vue';

const convexUrl = import.meta.env.VITE_CONVEX_URL || '';
const feedbackEnabled = import.meta.env.VITE_FEEDBACK_ENABLED === 'true' && !!convexUrl;
</script>
```

**Environment Variables (`.env`):**

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_FEEDBACK_ENABLED=true
```

---

### Vanilla JavaScript (ES Modules)

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/annotated-feedback/widget/dist/styles.css">
</head>
<body>
  <div id="app">Your app content</div>
  <div id="feedback-root"></div>

  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { FeedbackProvider } from 'annotated-feedback/widget';

    const root = createRoot(document.getElementById('feedback-root'));

    root.render(
      React.createElement(FeedbackProvider, {
        convexUrl: 'https://your-deployment.convex.cloud',
        project: 'your-project',
        enabled: true,
        hotkey: 'Alt+F',
        showButton: true
      })
    );
  </script>
</body>
</html>
```

---

## COMMON ISSUES & SOLUTIONS

### Issue 1: "Invalid hook call" or "Cannot read properties of null (reading 'useState')"

**Cause:** Multiple React instances (FIXED in v0.1.23+)

**Solution:**
```bash
# Update to v0.1.24 or later
pnpm update annotated-feedback@latest

# Verify version is 0.1.24+
pnpm list annotated-feedback
```

**If still occurring on v0.1.24+:**
- Check for duplicate React: `pnpm list react`
- Clear cache: `rm -rf node_modules/.cache .next`
- Reinstall: `pnpm install`

---

### Issue 2: "Cannot find module 'roughjs/bin/rough'" (Next.js SSR)

**Cause:** Excalidraw SSR incompatibility (FIXED in v0.1.23+)

**Solution:**
```bash
# Update to v0.1.23 or later (has dynamic Excalidraw import)
pnpm update annotated-feedback@latest
```

**If still occurring:** Verify you're on v0.1.23+ and restart dev server.

---

### Issue 3: "Can't resolve './fonts/Assistant/*.woff2'"

**Cause:** Missing font files in Excalidraw CSS (FIXED in v0.1.22+)

**Solution:**
```bash
# Update to v0.1.22 or later (fonts stripped from CSS)
pnpm update annotated-feedback@latest
```

---

### Issue 4: Dashboard Convex queries fail after adding widget

**Cause:** Widget's ConvexProvider overriding parent context (FIXED in v0.1.24+)

**Solution:**
```bash
# Update to v0.1.24 or later (isolated Convex contexts)
pnpm update annotated-feedback@latest
```

**Architecture:** v0.1.24+ only wraps the feedback overlay with ConvexProvider, leaving your app's Convex context intact.

---

### Issue 5: Widget doesn't appear

**Checklist:**
1. Is `CONVEX_URL` environment variable set?
2. Is `enabled` prop set to `true`?
3. Check browser console for errors
4. Try pressing the hotkey (default: Alt+F)
5. If `showButton={true}`, check for floating button in bottom-right corner
6. Wait 1-2 seconds for Excalidraw to load dynamically (v0.1.23+)

---

## CONVEX BACKEND SETUP

The widget requires a Convex backend to store feedback submissions.

### Option 1: Use Existing Convex Deployment

If the user already has a Convex deployment, they need to:

1. Copy the schema and functions from the package:
   - Schema: `node_modules/annotated-feedback/convex/schema.ts`
   - Functions: `node_modules/annotated-feedback/convex/feedback.ts`

2. Add to their Convex project:
```bash
cp node_modules/annotated-feedback/convex/*.ts ./convex/
```

3. Deploy:
```bash
npx convex deploy
```

### Option 2: Create New Convex Deployment

1. Go to https://dashboard.convex.dev
2. Create new project
3. Copy deployment URL (format: `https://xxx-xxx-123.convex.cloud`)
4. Copy schema and functions (same as Option 1)
5. Run `npx convex dev` to deploy

---

## 🎯 FINAL STEP: MCP SERVER SETUP (REQUIRED)

**This is NOT optional - it's the entire point of installing the widget!**

After successful widget installation and testing, instruct the user to:

1. **Run this command in their terminal (OUTSIDE of Claude):**

```bash
claude mcp add annotated-feedback \
  --scope project \
  -- env \
    CONVEX_URL="<CONVEX_URL>" \
    PROJECT="<PROJECT_NAME>" \
  npx -y annotated-feedback
```

2. **Provide them with the actual command to copy/paste:**

Replace `<CONVEX_URL>` and `<PROJECT_NAME>` with the values you collected at the start.

**Example output to user:**

```
✅ Widget installation complete!

📋 NEXT STEP: Install the MCP server so Claude can interact with your feedback.

Copy and paste this command in your terminal (outside of this chat):

claude mcp add annotated-feedback \
  --scope project \
  -- env \
    CONVEX_URL="https://utmost-llama-56.convex.cloud" \
    PROJECT="my-awesome-app" \
  npx -y annotated-feedback

Then start a new Claude session to activate the MCP integration.
```

3. **Tell the user to start a new Claude session** after running the command

The MCP server allows Claude to:
- List all feedback submissions
- View feedback with annotations
- Update feedback status
- Filter by project, status, priority

---

## TESTING

After installation, test the widget:

1. Start your dev server
2. Open the app in browser
3. Press **Alt+F** (or configured hotkey)
4. Feedback overlay should appear with:
   - Toolbar at top (input field, submit button)
   - Excalidraw drawing canvas
   - Drawing tools in corner (configurable position with 📍 button)

5. Test workflow:
   - Draw annotations on the screenshot
   - Add a text note
   - Click "Submit"
   - Should see success toast: "Feedback submitted successfully!"

6. Verify in Convex dashboard:
   - Go to https://dashboard.convex.dev
   - Select your deployment
   - Check `feedback` table for new entries

---

## TROUBLESHOOTING CHECKLIST

Before asking for help, verify:

- [ ] **`annotated-feedback` version is 0.1.24 or higher** (check `pnpm list annotated-feedback`)
- [ ] React 18+ or 19+ is installed (check `package.json`)
- [ ] Convex URL is set in environment variables
- [ ] **For Next.js**: No webpack/transpilePackages config needed (widget handles SSR)
- [ ] **For apps with existing ConvexProvider**: Widget uses isolated context (v0.1.24+)
- [ ] For Vue: Vite config includes React plugin and dedupe config
- [ ] For Vue: React alias paths match installed version
- [ ] Cache cleared: `rm -rf node_modules/.cache .next node_modules/.vite`
- [ ] Dev server restarted after installation
- [ ] No console errors in browser DevTools
- [ ] Browser console shows no 404s for widget assets
- [ ] Wait 1-2 seconds after pressing Alt+F for Excalidraw to load

---

## CONFIGURATION REFERENCE

### FeedbackProvider Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `convexUrl` | string | Yes | - | Convex deployment URL |
| `project` | string | Yes | - | Project identifier |
| `enabled` | boolean | Yes | - | Enable/disable widget |
| `hotkey` | string | No | "Alt+F" | Keyboard shortcut |
| `showButton` | boolean | No | false | Show floating toggle button |
| `getContext` | function | No | - | Callback for dynamic metadata |

### Metadata Structure

```typescript
interface FeedbackMetadata {
  route?: string;        // App route (e.g., "/dashboard")
  releaseId?: string;    // Git SHA or version
  env?: string;          // Environment: "dev" | "staging" | "production"
  userHash?: string;     // K-anonymized user ID
  flags?: string[];      // Active feature flags
  project?: string;      // Project name
}
```

---

## SUCCESS CRITERIA

Widget installation is complete when:

1. ✅ Package installed (v0.1.24+) and no build errors
2. ✅ Dev server starts without warnings about the widget
3. ✅ **Parent app's Convex queries still work** (if applicable)
4. ✅ Pressing Alt+F opens the feedback overlay
5. ✅ Brief "Loading drawing tools..." appears (~1-2 seconds)
6. ✅ Excalidraw canvas loads and drawing tools appear
7. ✅ Can draw annotations on the canvas
8. ✅ Submitting feedback shows success toast
9. ✅ Feedback appears in Convex dashboard (utmost-llama-56 deployment)

**THEN provide the MCP installation command** with substituted values.

---

## INSTALLATION FLOW SUMMARY

```
1. Ask for prerequisites (Convex URL, Project Name)
   ↓
2. Detect framework
   ↓
3. Install packages
   ↓
4. Apply framework-specific configuration
   ↓
5. Set environment variables
   ↓
6. Test the widget
   ↓
7. ✅ SUCCESS: Provide MCP installation command
   ↓
8. Tell user to run command and start new session
```

---

## NEED HELP?

If issues persist:

1. Check package version: `pnpm list annotated-feedback`
2. Check for duplicate React: `pnpm list react`
3. Review browser console errors (screenshot helpful)
4. Check Network tab for failed requests
5. Verify Convex backend is accessible

**Package Repository:** https://github.com/screwyforcepush/annotated-feedback
**NPM Package:** https://www.npmjs.com/package/annotated-feedback
