var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/FeedbackProvider.tsx
import { useEffect as useEffect3, useMemo, useState as useState2 } from "react";
import { ConvexProvider as ConvexProvider2, ConvexReactClient as ConvexReactClient2 } from "convex/react";

// src/FeedbackOverlayManager.tsx
import React2, { useEffect as useEffect2, useRef as useRef2 } from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// src/FeedbackOverlay.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useMutation } from "convex/react";

// src/utils/pii-redaction.ts
var REDACTION_CLASS = "feedback-widget-redact";
function applyPIIRedaction() {
  const redactedElements = [];
  const hiddenElements = [];
  const seen = /* @__PURE__ */ new Set();
  const markHidden = (element) => {
    if (seen.has(element)) return;
    seen.add(element);
    hiddenElements.push({
      element,
      previousHidden: element.getAttribute("data-feedback-widget-hidden")
    });
    element.setAttribute("data-feedback-widget-hidden", "true");
  };
  const markRedacted = (element) => {
    if (seen.has(element)) return;
    seen.add(element);
    element.classList.add(REDACTION_CLASS);
    redactedElements.push(element);
  };
  SENSITIVE_FIELD_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      const element = node;
      if (element.dataset.noCapture === "true") {
        markHidden(element);
        return;
      }
      if (element.tagName.toLowerCase() === "input" && element.getAttribute("type") === "password") {
        markRedacted(element);
        return;
      }
      if (element.matches(".sensitive-data") || element.dataset.sensitive === "true") {
        markRedacted(element);
        return;
      }
      if (element.getAttribute("autocomplete")?.startsWith("cc-")) {
        markRedacted(element);
        return;
      }
      markRedacted(element);
    });
  });
  return () => {
    redactedElements.forEach((element) => {
      element.classList.remove(REDACTION_CLASS);
    });
    hiddenElements.forEach(({ element, previousHidden }) => {
      if (previousHidden !== null) {
        element.setAttribute("data-feedback-widget-hidden", previousHidden);
      } else {
        element.removeAttribute("data-feedback-widget-hidden");
      }
    });
  };
}
var SENSITIVE_FIELD_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete^="cc-"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  '[data-sensitive="true"]',
  '[data-no-capture="true"]',
  ".sensitive-data"
];

// src/utils/screenshot.ts
import { toBlob } from "html-to-image";
async function captureScreenshot(targetElement = document.body, options = {}) {
  const mergedOptions = {
    ...DEFAULT_SCREENSHOT_OPTIONS,
    ...options
  };
  const {
    pixelRatio = 1,
    quality = 0.92,
    backgroundColor = null
  } = mergedOptions;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const blob = await toBlob(targetElement, {
    pixelRatio,
    quality,
    backgroundColor: backgroundColor || void 0,
    // null -> undefined for proper transparency
    cacheBust: true,
    // Prevent CORS caching issues
    // Constrain output to viewport dimensions
    width: viewportWidth,
    height: viewportHeight,
    // Offset the element to capture the visible viewport area
    style: {
      margin: "0",
      padding: "0",
      transform: `translate(-${scrollX}px, -${scrollY}px)`
    }
  });
  if (!blob) {
    throw new Error("Failed to create screenshot blob. This may be caused by CORS issues with external resources.");
  }
  return blob;
}
var DEFAULT_SCREENSHOT_OPTIONS = {
  pixelRatio: 1,
  quality: 0.92,
  backgroundColor: null
  // Transparent background
};

// src/FeedbackOverlay.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function deriveSubmissionPath(metadata) {
  if (metadata?.path && metadata.path.trim().length > 0) {
    return metadata.path;
  }
  if (metadata?.route && metadata.route.trim().length > 0) {
    return `route:${metadata.route}`;
  }
  if (metadata?.project && metadata.project.trim().length > 0) {
    return `project:${metadata.project}`;
  }
  return "unmapped-feedback";
}
function Toast({ message, type = "success", onClose }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 5e3);
    return () => clearTimeout(timer);
  }, [onClose]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: `feedback-widget-toast${type === "error" ? " feedback-widget-toast--error" : ""}`,
      role: "status",
      children: message
    }
  );
}
function LoadingSpinner() {
  return /* @__PURE__ */ jsx("div", { className: "feedback-widget-loading-spinner", "aria-hidden": "true" });
}
function hideInterfaceElements(toolbar, extraSelectors) {
  const hiddenElements = [];
  const hide = (element) => {
    if (!element) return;
    hiddenElements.push({
      element,
      previousDisplay: element.style.display
    });
    element.style.display = "none";
  };
  if (toolbar) {
    hide(toolbar);
  }
  const selectorList = extraSelectors ?? [];
  if (selectorList.length > 0) {
    document.querySelectorAll(selectorList.join(",")).forEach((node) => {
      hide(node);
    });
  }
  return () => {
    hiddenElements.forEach(({ element, previousDisplay }) => {
      element.style.display = previousDisplay;
    });
  };
}
function FeedbackOverlay({ onClose, metadata }) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [toolbarPosition, setToolbarPosition] = useState("top-left");
  const excalidrawAPIRef = useRef(null);
  const generateUploadUrl = useMutation("feedback:generateUploadUrl");
  const submitFeedback = useMutation("feedback:submit");
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const handleSubmit = useCallback(async () => {
    if (!excalidrawAPIRef.current) {
      setToast({ message: "Drawing canvas not ready", type: "error" });
      return;
    }
    const submissionPath = deriveSubmissionPath(metadata);
    if (!submissionPath) {
      setToast({ message: "Callback metadata missing path/route", type: "error" });
      return;
    }
    setIsSubmitting(true);
    const sceneElements = excalidrawAPIRef.current.getSceneElements();
    const overlayJSON = JSON.stringify(sceneElements);
    const toolbar = document.getElementById("feedback-toolbar");
    const toggleButton = document.getElementById("feedback-toggle-button");
    const hideUI = hideInterfaceElements(toolbar, [
      ".App-menu",
      ".layer-ui__wrapper",
      ".zen-mode-transition",
      ".zoom-actions",
      ".Stack_vertical.App-menu_top__left",
      '[class*="layer-ui__wrapper"]',
      ".undo-redo-buttons",
      '[class*="undo-redo"]'
    ]);
    if (toggleButton) {
      toggleButton.style.display = "none";
    }
    const restorePII = applyPIIRedaction();
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const screenshotBlob = await captureScreenshot(document.body, {
        ...DEFAULT_SCREENSHOT_OPTIONS,
        backgroundColor: null
      });
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: screenshotBlob
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      const { storageId } = await uploadResponse.json();
      const trimmedNote = note.trim();
      const submissionMetadata = {
        ...metadata ?? {}
      };
      if (!submissionMetadata.path) {
        submissionMetadata.path = submissionPath;
      }
      const submitArgs = {
        url: window.location.href,
        path: submissionPath,
        note: trimmedNote.length > 0 ? trimmedNote : void 0,
        overlayJSON,
        screenshot: storageId,
        ua: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        // Universal widget fields (top-level, not nested in metadata)
        route: submissionMetadata.route,
        releaseId: submissionMetadata.releaseId,
        env: submissionMetadata.env,
        userHash: submissionMetadata.userHash,
        flags: submissionMetadata.flags,
        project: submissionMetadata.project
      };
      await submitFeedback(submitArgs);
      setToast({ message: "Feedback submitted successfully!", type: "success" });
      setNote("");
      if (excalidrawAPIRef.current) {
        const appState = excalidrawAPIRef.current.getAppState();
        excalidrawAPIRef.current.updateScene({
          elements: [],
          appState
        });
      }
    } catch (error) {
      console.error("[FeedbackOverlay] Submission failed:", error);
      setToast({
        message: error instanceof Error ? error.message : "Failed to submit feedback",
        type: "error"
      });
    } finally {
      hideUI();
      restorePII();
      if (toggleButton) {
        toggleButton.style.display = "";
      }
      setIsSubmitting(false);
    }
  }, [metadata, note, onClose, generateUploadUrl, submitFeedback]);
  const handleReset = useCallback(() => {
    setNote("");
    if (excalidrawAPIRef.current) {
      const appState = excalidrawAPIRef.current.getAppState();
      excalidrawAPIRef.current.updateScene({
        elements: [],
        appState
      });
    }
  }, []);
  const cycleToolbarPosition = useCallback(() => {
    setToolbarPosition((prev) => {
      const positions = ["top-left", "top-right", "bottom-right", "bottom-left"];
      const currentIndex = positions.indexOf(prev);
      const nextIndex = (currentIndex + 1) % positions.length;
      return positions[nextIndex] || "top-right";
    });
  }, []);
  useEffect(() => {
    const handleWheel = (event) => {
      const target = event.target;
      if (target.closest(".excalidraw") && !target.closest(".App-menu")) {
        event.preventDefault();
        event.stopPropagation();
        window.scrollBy({
          top: event.deltaY,
          left: event.deltaX,
          behavior: "auto"
        });
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);
  const TOOLBAR_HEIGHT = 60;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("style", { children: `
        .Stack.Stack_vertical.App-menu_top__left {
          display: none !important;
        }

        .layer-ui__wrapper__top-right.zen-mode-transition {
          display: none !important;
        }

        .Stack.Stack_vertical.zoom-actions {
          display: none !important;
        }

        .excalidraw-toolbar-top-left .App-menu_top {
          position: fixed !important;
          display: block !important;
          top: ${TOOLBAR_HEIGHT + 10}px !important;
          left: 10px !important;
          right: auto !important;
          bottom: auto !important;
        }

        .excalidraw-toolbar-top-right .App-menu_top {
          position: fixed !important;
          display: block !important;
          top: ${TOOLBAR_HEIGHT + 10}px !important;
          right: 10px !important;
          left: auto !important;
          bottom: auto !important;
        }

        .excalidraw-toolbar-bottom-left .App-menu_top {
          position: fixed !important;
          display: block !important;
          bottom: 10px !important;
          left: 10px !important;
          top: auto !important;
          right: auto !important;
        }

        .excalidraw-toolbar-bottom-right .App-menu_top {
          position: fixed !important;
          display: block !important;
          bottom: 10px !important;
          right: 10px !important;
          top: auto !important;
          left: auto !important;
        }
      ` }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        id: "feedback-toolbar",
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: `${TOOLBAR_HEIGHT}px`,
          zIndex: 1e4,
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 16px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          boxSizing: "border-box",
          pointerEvents: "auto"
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                fontSize: "14px",
                fontWeight: 600,
                color: "#374151",
                fontFamily: "system-ui, -apple-system, sans-serif"
              },
              children: "Feedback Mode"
            }
          ),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: note,
              onChange: (event) => setNote(event.target.value),
              placeholder: "Describe your change request",
              maxLength: 2e3,
              disabled: isSubmitting,
              style: {
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "13px",
                fontFamily: "system-ui, -apple-system, sans-serif",
                outline: "none",
                transition: "border-color 0.2s"
              },
              onFocus: (event) => {
                event.target.style.borderColor = "#3b82f6";
              },
              onBlur: (event) => {
                event.target.style.borderColor = "#d1d5db";
              }
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: cycleToolbarPosition,
              disabled: isSubmitting,
              title: `Tools: ${toolbarPosition}`,
              style: {
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontFamily: "system-ui, -apple-system, sans-serif",
                opacity: isSubmitting ? 0.5 : 1,
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              },
              onMouseEnter: (event) => {
                if (!isSubmitting) {
                  event.currentTarget.style.background = "#f9fafb";
                }
              },
              onMouseLeave: (event) => {
                event.currentTarget.style.background = "white";
              },
              children: "\u{1F4CD}"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleReset,
              disabled: isSubmitting,
              style: {
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontFamily: "system-ui, -apple-system, sans-serif",
                opacity: isSubmitting ? 0.5 : 1,
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              },
              onMouseEnter: (event) => {
                if (!isSubmitting) {
                  event.currentTarget.style.background = "#f9fafb";
                }
              },
              onMouseLeave: (event) => {
                event.currentTarget.style.background = "white";
              },
              children: "Reset"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => void handleSubmit(),
              disabled: isSubmitting,
              style: {
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                color: "white",
                background: isSubmitting ? "#9ca3af" : "#3b82f6",
                border: "none",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontFamily: "system-ui, -apple-system, sans-serif",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              },
              onMouseEnter: (event) => {
                if (!isSubmitting) {
                  event.currentTarget.style.background = "#2563eb";
                }
              },
              onMouseLeave: (event) => {
                if (!isSubmitting) {
                  event.currentTarget.style.background = "#3b82f6";
                }
              },
              children: isSubmitting ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(LoadingSpinner, {}),
                "Submitting..."
              ] }) : "Submit"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: `excalidraw-toolbar-${toolbarPosition}`,
        style: {
          position: "fixed",
          top: `${TOOLBAR_HEIGHT}px`,
          left: 0,
          width: "100vw",
          height: `${viewportHeight - TOOLBAR_HEIGHT}px`,
          zIndex: 9999,
          overflow: "hidden",
          pointerEvents: "auto"
        },
        children: /* @__PURE__ */ jsx(
          Excalidraw,
          {
            excalidrawAPI: (api) => {
              excalidrawAPIRef.current = api;
            },
            initialData: {
              appState: {
                viewBackgroundColor: "transparent",
                currentItemStrokeColor: "#ff0000"
                // Red stroke for visibility
              }
            }
          }
        )
      }
    ),
    toast && /* @__PURE__ */ jsx(
      Toast,
      {
        message: toast.message,
        type: toast.type,
        onClose: () => setToast(null)
      }
    )
  ] });
}

// src/FeedbackOverlayManager.tsx
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function OverlayController({
  onCloseRef,
  onToggleRef,
  metadataRef,
  showButton
}) {
  const [isVisible, setIsVisible] = React2.useState(persistentVisibilityState);
  const [buttonVisible, setButtonVisible] = React2.useState(showButton);
  useEffect2(() => {
    const handleToggle = (event) => {
      const customEvent = event;
      const newVisibility = customEvent.detail.enabled;
      setIsVisible(newVisibility);
      persistentVisibilityState = newVisibility;
      if (customEvent.detail.showButton !== void 0) {
        setButtonVisible(customEvent.detail.showButton);
      }
    };
    const handleToggleRequest = (event) => {
      const customEvent = event;
      if (customEvent.detail.toggle) {
        const newVisibility = !isVisible;
        setIsVisible(newVisibility);
        persistentVisibilityState = newVisibility;
        if (newVisibility) {
          onToggleRef.current?.();
        } else {
          onCloseRef.current?.();
        }
      }
    };
    window.addEventListener("feedback-overlay-toggle", handleToggle);
    window.addEventListener("feedback-overlay-toggle-request", handleToggleRequest);
    return () => {
      window.removeEventListener("feedback-overlay-toggle", handleToggle);
      window.removeEventListener("feedback-overlay-toggle-request", handleToggleRequest);
    };
  }, [isVisible]);
  return /* @__PURE__ */ jsxs2(Fragment2, { children: [
    buttonVisible && /* @__PURE__ */ jsx2(
      "button",
      {
        id: "feedback-toggle-button",
        onClick: () => {
          window.dispatchEvent(
            new CustomEvent("feedback-overlay-toggle-request", {
              detail: { toggle: true }
            })
          );
        },
        style: {
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 2147483647,
          backgroundColor: isVisible ? "#8b5cf6" : "#6366f1",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "56px",
          height: "56px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          transition: "all 0.2s ease",
          pointerEvents: "auto"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
        },
        title: isVisible ? "Close Feedback (Alt+F)" : "Give Feedback (Alt+F)",
        "aria-label": isVisible ? "Close Feedback" : "Give Feedback",
        children: isVisible ? "\u2715" : "\u{1F4AC}"
      }
    ),
    isVisible && /* @__PURE__ */ jsx2(
      FeedbackOverlay,
      {
        onClose: () => onCloseRef.current?.(),
        metadata: metadataRef.current
      }
    )
  ] });
}
var overlayRoot = null;
var overlayContainer = null;
var currentConvexClient = null;
var persistentVisibilityState = false;
function FeedbackOverlayManager({
  enabled,
  onClose,
  onToggle,
  metadata,
  convexUrl,
  showButton = false
}) {
  const onCloseRef = useRef2(onClose);
  const onToggleRef = useRef2(onToggle);
  const metadataRef = useRef2(metadata);
  useEffect2(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect2(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);
  useEffect2(() => {
    metadataRef.current = metadata;
  }, [metadata]);
  useEffect2(() => {
    if (!convexUrl) {
      console.warn("[FeedbackWidget] convexUrl not provided");
      return;
    }
    if (!currentConvexClient) {
      currentConvexClient = new ConvexReactClient(convexUrl);
    }
    if (!overlayContainer) {
      overlayContainer = document.createElement("div");
      overlayContainer.id = "feedback-overlay-root";
      document.body.appendChild(overlayContainer);
      overlayRoot = ReactDOM.createRoot(overlayContainer);
      overlayRoot.render(
        /* @__PURE__ */ jsx2(ConvexProvider, { client: currentConvexClient, children: /* @__PURE__ */ jsx2(
          OverlayController,
          {
            onCloseRef,
            onToggleRef,
            metadataRef,
            showButton
          }
        ) })
      );
      persistentVisibilityState = enabled;
      window.dispatchEvent(
        new CustomEvent("feedback-overlay-toggle", {
          detail: { enabled, showButton }
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("feedback-overlay-toggle", {
          detail: { enabled: persistentVisibilityState, showButton }
        })
      );
    }
  }, [enabled, convexUrl, showButton]);
  return null;
}

// src/FeedbackProvider.tsx
import { Fragment as Fragment3, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var singletonConvexClient = null;
function getConvexClient(convexUrl) {
  if (!singletonConvexClient) {
    singletonConvexClient = new ConvexReactClient2(convexUrl);
  }
  return singletonConvexClient;
}
var cachedUsePathname;
function resolveUsePathname() {
  if (cachedUsePathname !== void 0) {
    return cachedUsePathname ?? null;
  }
  try {
    const navigation = __require("next/navigation");
    cachedUsePathname = navigation?.usePathname ?? navigation?.default?.usePathname ?? null;
  } catch {
    cachedUsePathname = null;
  }
  return cachedUsePathname ?? null;
}
function useRoute() {
  const usePathnameHook = resolveUsePathname();
  if (usePathnameHook) {
    const pathname = usePathnameHook();
    if (pathname) {
      return pathname;
    }
  }
  const [route, setRoute] = useState2(
    typeof window !== "undefined" ? window.location.pathname : ""
  );
  useEffect3(() => {
    const handleRouteChange = () => {
      setRoute(window.location.pathname);
    };
    handleRouteChange();
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);
  return route;
}
function parseHotkey(hotkey) {
  const parts = hotkey.split("+").map((p) => p.trim());
  const key = (parts[parts.length - 1] || "").toLowerCase();
  return {
    altKey: parts.some((p) => p.toLowerCase() === "alt"),
    ctrlKey: parts.some((p) => p.toLowerCase() === "ctrl"),
    shiftKey: parts.some((p) => p.toLowerCase() === "shift"),
    key
  };
}
function FeedbackProvider({
  convexUrl,
  project,
  enabled,
  hotkey = "Alt+F",
  showButton = false,
  getContext,
  children
}) {
  const [isOpen, setIsOpen] = useState2(false);
  const route = useRoute();
  useEffect3(() => {
    if (!convexUrl) {
      console.warn("[FeedbackWidget] convexUrl not provided - widget will not function correctly");
    }
  }, [convexUrl]);
  useEffect3(() => {
    if (!enabled) return;
    const hotkeyConfig = parseHotkey(hotkey);
    const handleKeyDown = (e) => {
      const modifiersMatch = (hotkeyConfig.altKey ? e.altKey : !e.altKey) && (hotkeyConfig.ctrlKey ? e.ctrlKey : !e.ctrlKey) && (hotkeyConfig.shiftKey ? e.shiftKey : !e.shiftKey);
      const keyMatches = e.key.toLowerCase() === hotkeyConfig.key;
      if (modifiersMatch && keyMatches) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, hotkey]);
  const convexClient = useMemo(() => {
    if (!convexUrl) return null;
    return getConvexClient(convexUrl);
  }, [convexUrl]);
  const metadata = useMemo(() => {
    const globalRoute = typeof globalThis !== "undefined" && globalThis.__FEEDBACK_WIDGET_ROUTE__;
    const normalizedRoute = route && route.length > 0 ? route : typeof globalRoute === "string" && globalRoute.length > 0 ? globalRoute : typeof window !== "undefined" ? window.location.pathname || "/" : "/";
    let contextData = {};
    try {
      const result = getContext?.();
      if (result) {
        contextData = result;
      }
    } catch (error) {
      console.error("[FeedbackWidget] Error in getContext callback:", error);
    }
    return {
      route: normalizedRoute,
      url: typeof window !== "undefined" ? window.location.href : void 0,
      project,
      ...contextData
    };
  }, [route, project, getContext]);
  if (!convexClient) {
    return /* @__PURE__ */ jsx3(Fragment3, { children });
  }
  return /* @__PURE__ */ jsxs3(ConvexProvider2, { client: convexClient, children: [
    children,
    enabled && /* @__PURE__ */ jsx3(
      FeedbackOverlayManager,
      {
        enabled: isOpen,
        onClose: () => setIsOpen(false),
        onToggle: () => setIsOpen((prev) => !prev),
        metadata,
        convexUrl,
        showButton
      }
    )
  ] });
}

// src/utils/metadata.ts
function getViewportDimensions() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}
function getUserAgent() {
  return window.navigator.userAgent;
}
function generateUserHash(userId) {
  if (!userId) return void 0;
  throw new Error("generateUserHash not yet implemented");
}
function gatherMetadata(additionalContext) {
  return {
    ...additionalContext
    // Add more automatic detection:
    // - route from window.location.pathname
    // - env from process.env or window.__ENV__
    // etc.
  };
}
export {
  DEFAULT_SCREENSHOT_OPTIONS,
  FeedbackOverlay,
  FeedbackOverlayManager,
  FeedbackProvider,
  SENSITIVE_FIELD_SELECTORS,
  applyPIIRedaction,
  captureScreenshot,
  gatherMetadata,
  generateUserHash,
  getUserAgent,
  getViewportDimensions
};
