# Annotated Feedback Widget Setup

The annotated feedback widget has been successfully integrated into the Vue 3 client app.

## Installation Summary

### Dependencies Installed
- `react@^18.3.1` - React runtime for the feedback widget
- `react-dom@^18.3.1` - React DOM for rendering
- `annotated-feedback-widget@0.1.1` - The feedback widget package (local dependency)
- `@vitejs/plugin-react@5.1.1` - Vite plugin for React support
- `@types/react@19.2.6` - React TypeScript definitions
- `@types/react-dom@19.2.3` - React DOM TypeScript definitions

### Files Modified/Created
1. **vite.config.ts** - Added React plugin for dual Vue/React support
2. **src/components/FeedbackWidget.vue** - Vue wrapper component for React widget
3. **src/App.vue** - Integrated FeedbackWidget component
4. **.env** - Added VITE_CONVEX_URL and VITE_FEEDBACK_ENABLED
5. **.env.sample** - Updated with feedback widget configuration examples

## Configuration

### Environment Variables

Add your Convex deployment URL to `.env`:

```bash
# Feedback Widget Configuration
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_FEEDBACK_ENABLED=true
```

**To get your Convex URL:**
1. Go to [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. Create a new project or select existing project
3. Copy the deployment URL from the dashboard
4. Paste it into your `.env` file

### How It Works

The integration uses a Vue wrapper component that:
1. Creates a React root using `createRoot` from `react-dom/client`
2. Mounts the React `FeedbackProvider` component
3. Properly cleans up on unmount

This approach allows the React feedback widget to coexist with the Vue 3 app without conflicts.

## Usage

### Keyboard Shortcut
Press **Alt+F** to toggle the feedback widget overlay

### Toggle Button
A floating feedback button appears in the bottom-right corner when enabled

### Submitting Feedback
1. Press Alt+F or click the floating button
2. Annotate the screenshot using the drawing tools
3. Add a text description (optional)
4. Click "Submit" to send feedback to Convex backend

## Features

- **Visual Annotations**: Draw arrows, rectangles, text, and freehand on screenshots
- **Screenshot Capture**: Automatically captures the viewport with PII redaction
- **Context Metadata**: Includes route, environment, and URL with each submission
- **Portal Rendering**: Widget renders outside Vue component tree for stability
- **Hotkey Support**: Configurable keyboard shortcuts (default: Alt+F)

## Disabling the Widget

### Temporary Disable
Set in `.env`:
```bash
VITE_FEEDBACK_ENABLED=false
```

### Permanent Disable
Remove or comment out the `<FeedbackWidget>` component in `src/App.vue`:
```vue
<!-- <FeedbackWidget ... /> -->
```

## Architecture Notes

### Why React in a Vue App?
The feedback widget is originally built in React, and we chose to bundle React rather than:
- Porting to Vue (time-consuming, potential bugs)
- Using iframe (screenshot capture wouldn't work)
- Building Web Component (same bundle size, more complexity)

**Bundle Impact**: ~270KB gzipped (React + Excalidraw + widget code)

### Framework Coexistence
Vite supports both Vue and React plugins simultaneously. The React code is isolated to the feedback widget and doesn't interfere with Vue:
- Vue handles the main app
- React handles only the feedback overlay
- Both frameworks are tree-shaken and optimized by Vite

## Troubleshooting

### Widget doesn't appear
- Check that `VITE_CONVEX_URL` is set in `.env`
- Check that `VITE_FEEDBACK_ENABLED=true`
- Restart dev server after changing `.env` values

### Screenshot capture issues
- Ensure the app is running in a browser (not server-side)
- Check browser console for CORS errors
- Verify Convex backend is accessible

### TypeScript errors
- Ensure `@types/react` and `@types/react-dom` are installed
- Run `pnpm install` to ensure all dependencies are present

## Backend Setup (Convex)

The widget requires a Convex backend to store feedback submissions. See the widget repository for:
- Convex schema definitions
- Mutation functions (`feedback:submit`, `feedback:generateUploadUrl`)
- Query functions for viewing feedback

## Support

For issues with the feedback widget itself, see:
- [Widget Documentation](../../annotated-feedback/widget/README.md)
- [Convex Documentation](https://docs.convex.dev)
