// AssignmentPane - Collapsible right sidebar showing assignment details + job chain
// WP-8: Transformed to Q palette brandkit styling
// WP-7: Added StatusPill dropdown (U5) and multi-assignment navigation (U6)
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "../../hooks/useConvex.js";
import { api } from "../../api.js";
import { StatusBadge } from "../shared/StatusBadge.js";
import { JobChain } from "../job/JobChain.js";
import { JsonViewer } from "../shared/JsonViewer.js";
import { QIcon } from "../shared/index.js";

/**
 * Two-tier subscription hook for job chain data.
 * Tier 1 (Archive): All groups + terminal job data. Rarely invalidates.
 * Tier 2 (Live): Active group job data only. Frequent but tiny.
 */
function useGroupJobsTwoTier(assignmentId) {
  // Tier 1: Archive — chain structure + terminal jobs
  const { data: archive } = useQuery(
    assignmentId ? api.assignments.getChainWithTerminalJobs : null,
    assignmentId ? { id: assignmentId } : {}
  );

  // Tier 2: Live Wire — active group jobs only
  const { data: liveGroups } = useQuery(
    assignmentId ? api.jobs.getActiveGroupsWithJobs : null,
    assignmentId ? { assignmentId } : {}
  );

  return useMemo(() => {
    if (!archive?.groups) return [];

    // Build lookup: groupId → live jobs
    const liveJobMap = {};
    if (liveGroups) {
      for (const entry of liveGroups) {
        liveJobMap[entry.groupId] = entry.jobs;
      }
    }

    // Merge: archive provides chain order, live wins for active groups
    return archive.groups.map((group) => {
      const jobs = group.isTerminal
        ? group.jobs          // Terminal: use archive (immutable)
        : (liveJobMap[group._id] || []);  // Active: use live data
      return { ...group, jobs };
    });
  }, [archive, liveGroups]);
}

/**
 * Close icon (X)
 */
function CloseIcon() {
  return React.createElement(
    "svg",
    {
      style: {
        width: "20px",
        height: "20px",
      },
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      strokeWidth: "2",
    },
    React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: "M6 18L18 6M6 6l12 12",
    }),
  );
}


/**
 * StatusPill - Clickable status badge with dropdown for editing assignment status (U5)
 * Shows current status as a styled pill; clicking opens a dropdown with pending/active/blocked options.
 * @param {Object} props
 * @param {string} props.status - Current assignment status
 * @param {Function} props.onChangeStatus - Callback when a new status is selected
 */
function StatusPill({ status, onChangeStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredStatus, setHoveredStatus] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const pillRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close on outside click - check both pillRef and dropdownRef
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      const inPill = pillRef.current && pillRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inPill && !inDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Calculate dropdown position from pill's bounding rect when opening
  useEffect(() => {
    if (isOpen && pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [isOpen]);

  const statuses = ["pending", "active", "blocked"];
  const statusColors = {
    pending: "var(--q-copper1)",
    active: "var(--q-teleport-bright)",
    blocked: "var(--q-lava1)",
  };

  const currentColor = statusColors[status] || "var(--q-iron1)";

  return React.createElement(
    "div",
    {
      style: { display: "inline-block" },
    },
    // Pill button
    React.createElement(
      "button",
      {
        ref: pillRef,
        type: "button",
        onClick: () => setIsOpen(!isOpen),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 8px",
          fontFamily: "var(--font-display)",
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: currentColor,
          backgroundColor: "transparent",
          border: "1px solid " + currentColor,
          borderRadius: 0,
          cursor: "pointer",
          transition: "all var(--t-anim-transition-fast)",
        },
      },
      status || "unknown",
      React.createElement(QIcon, {
        name: "chevronDown",
        size: 10,
        color: "currentColor",
      }),
    ),
    // Dropdown - uses position:fixed to escape overflow:hidden ancestors
    isOpen &&
      React.createElement(
        "div",
        {
          ref: dropdownRef,
          style: {
            position: "fixed",
            top: dropdownPos.top + "px",
            left: dropdownPos.left + "px",
            minWidth: "120px",
            backgroundColor: "var(--q-stone2)",
            border: "1px solid var(--q-copper1)",
            borderRadius: 0,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          },
        },
        statuses.map((s) =>
          React.createElement(
            "button",
            {
              key: s,
              type: "button",
              onClick: () => {
                if (s !== status) {
                  onChangeStatus(s);
                }
                setIsOpen(false);
              },
              onMouseEnter: () => setHoveredStatus(s),
              onMouseLeave: () => setHoveredStatus(null),
              style: {
                display: "block",
                width: "100%",
                padding: "6px 12px",
                fontFamily: "var(--font-display)",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                textAlign: "left",
                color:
                  s === status
                    ? "var(--q-torch)"
                    : "var(--q-bone3)",
                backgroundColor:
                  s === status
                    ? "rgba(212, 160, 48, 0.12)"
                    : hoveredStatus === s
                      ? "var(--q-stone3)"
                      : "transparent",
                border: "none",
                borderRadius: 0,
                cursor: "pointer",
                transition: "all var(--t-anim-transition-fast)",
              },
            },
            s,
          ),
        ),
      ),
  );
}

/**
 * AssignmentNav - Multi-assignment prev/next navigation (U6)
 * Shows "Assignment X/N" with prev/next arrow buttons when thread has 2+ assignments.
 * @param {Object} props
 * @param {Object} props.thread - Thread object with assignmentsCreated array
 * @param {string} props.assignmentId - Current assignment ID
 * @param {Function} props.onChangeFocusAssignment - Callback when navigating to a different assignment
 */
function AssignmentNav({ thread, assignmentId, onChangeFocusAssignment }) {
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);

  const assignmentsCreated = thread?.assignmentsCreated;
  if (!assignmentsCreated || assignmentsCreated.length < 2) return null;

  const currentIndex = assignmentsCreated.indexOf(assignmentId);
  if (currentIndex === -1) return null;

  const total = assignmentsCreated.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  const arrowButtonStyle = (enabled, hovered) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    backgroundColor: hovered && enabled ? "var(--q-stone2)" : "transparent",
    border: "none",
    borderRadius: 0,
    color: enabled
      ? hovered
        ? "var(--q-copper3)"
        : "var(--q-copper2)"
      : "var(--q-iron0)",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.3,
    transition: "all var(--t-anim-transition-fast)",
  });

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
      },
    },
    // Prev button
    React.createElement(
      "button",
      {
        type: "button",
        disabled: !hasPrev,
        onClick: () => {
          if (hasPrev) onChangeFocusAssignment(assignmentsCreated[currentIndex - 1]);
        },
        onMouseEnter: () => setPrevHovered(true),
        onMouseLeave: () => setPrevHovered(false),
        style: arrowButtonStyle(hasPrev, prevHovered),
        title: "Previous assignment",
      },
      React.createElement(
        "svg",
        {
          style: { width: "14px", height: "14px" },
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          strokeWidth: "2",
        },
        React.createElement("polyline", {
          points: "15,18 9,12 15,6",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ),
    // "Assignment X/N" label
    React.createElement(
      "span",
      {
        style: {
          fontFamily: "var(--font-display)",
          fontSize: "12px",
          color: "var(--q-bone2)",
          letterSpacing: "1px",
          whiteSpace: "nowrap",
        },
      },
      `${currentIndex + 1}/${total}`,
    ),
    // Next button
    React.createElement(
      "button",
      {
        type: "button",
        disabled: !hasNext,
        onClick: () => {
          if (hasNext) onChangeFocusAssignment(assignmentsCreated[currentIndex + 1]);
        },
        onMouseEnter: () => setNextHovered(true),
        onMouseLeave: () => setNextHovered(false),
        style: arrowButtonStyle(hasNext, nextHovered),
        title: "Next assignment",
      },
      React.createElement(
        "svg",
        {
          style: { width: "14px", height: "14px" },
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          strokeWidth: "2",
        },
        React.createElement("polyline", {
          points: "9,6 15,12 9,18",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ),
  );
}

/**
 * Collapsible section header - Q palette styling
 */
function SectionHeader({ title, count, isOpen, onToggle }) {
  const [isHovered, setIsHovered] = useState(false);

  return React.createElement(
    "button",
    {
      type: "button",
      onClick: onToggle,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px",
        margin: "0 -8px",
        textAlign: "left",
        backgroundColor: isHovered ? "var(--q-stone2)" : "transparent",
        border: "none",
        borderRadius: 0,
        cursor: "pointer",
        transition: "background-color var(--t-anim-transition-fast)",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
        },
      },
      React.createElement(
        "h3",
        {
          style: {
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--q-bone2)",
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontFamily: "var(--font-display)",
            margin: 0,
          },
        },
        title,
      ),
      count !== undefined &&
        React.createElement(
          "span",
          {
            style: {
              fontSize: "12px",
              backgroundColor: "var(--q-stone3)",
              color: "var(--q-bone1)",
              padding: "2px 8px",
              borderRadius: 0,
            },
          },
          count,
        ),
    ),
    React.createElement(
      "span",
      {
        style: {
          display: "inline-flex",
          color: "var(--q-bone1)",
          transition: "transform var(--t-anim-transition-normal)",
          transform: isOpen ? "rotate(180deg)" : "none",
        },
      },
      React.createElement(QIcon, {
        name: "chevronDown",
        size: 16,
        color: "currentColor",
      }),
    ),
  );
}

/**
 * Parse JSON string safely
 */
function parseJson(str) {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Artifact item component - Q palette styling
 */
function ArtifactItem({ artifact }) {
  const isString = typeof artifact === "string";

  const itemStyle = {
    padding: "8px",
    backgroundColor: "var(--q-stone2)",
    border: "1px solid var(--q-stone3)",
    borderRadius: 0,
    fontSize: "12px",
  };

  if (isString) {
    return React.createElement(
      "div",
      { style: itemStyle },
      React.createElement(
        "p",
        {
          style: { color: "var(--q-bone2)", margin: 0 },
        },
        artifact,
      ),
    );
  }

  return React.createElement(
    "div",
    { style: itemStyle },
    artifact.name &&
      React.createElement(
        "p",
        {
          style: {
            fontWeight: 500,
            color: "var(--q-bone3)",
            marginBottom: "2px",
          },
        },
        artifact.name,
      ),
    artifact.path &&
      React.createElement(
        "code",
        {
          style: {
            color: "var(--q-copper2)",
            fontFamily: "var(--font-console)",
            display: "block",
            marginBottom: "4px",
            wordBreak: "break-all",
          },
        },
        artifact.path,
      ),
    artifact.description &&
      React.createElement(
        "p",
        {
          style: { color: "var(--q-bone1)", margin: 0 },
        },
        artifact.description,
      ),
    !artifact.name &&
      !artifact.path &&
      !artifact.description &&
      React.createElement(JsonViewer, {
        data: artifact,
        collapsed: true,
        maxHeight: 100,
      }),
  );
}

/**
 * Decision item component - Q palette styling with semantic status colors
 */
function DecisionItem({ decision, index }) {
  const isString = typeof decision === "string";

  const itemStyle = {
    padding: "8px",
    backgroundColor: "var(--q-stone2)",
    border: "1px solid var(--q-stone3)",
    borderRadius: 0,
    fontSize: "12px",
  };

  // Status badge styles using Q semantic colors
  const getStatusStyle = (status) => {
    switch (status) {
      case "approved":
        return {
          backgroundColor: "var(--q-slime0-08)",
          color: "var(--q-slime1)",
          border: "1px solid var(--q-slime1-44)",
        };
      case "rejected":
        return {
          backgroundColor: "var(--q-lava0-08)",
          color: "var(--q-lava1)",
          border: "1px solid var(--q-lava1-44)",
        };
      default:
        return {
          backgroundColor: "var(--q-stone3)",
          color: "var(--q-bone1)",
          border: "1px solid var(--q-stone3)",
        };
    }
  };

  if (isString) {
    return React.createElement(
      "div",
      { style: itemStyle },
      React.createElement(
        "p",
        {
          style: { color: "var(--q-bone2)", margin: 0 },
        },
        decision,
      ),
    );
  }

  return React.createElement(
    "div",
    { style: itemStyle },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "4px",
        },
      },
      React.createElement(
        "span",
        {
          style: {
            fontFamily: "var(--font-console)",
            fontWeight: 500,
            color: "var(--q-copper2)",
          },
        },
        decision.id || `D${index + 1}`,
      ),
      decision.status &&
        React.createElement(
          "span",
          {
            style: {
              ...getStatusStyle(decision.status),
              padding: "2px 6px",
              borderRadius: 0,
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            },
          },
          decision.status,
        ),
    ),
    (decision.decision || decision.description) &&
      React.createElement(
        "p",
        {
          style: {
            color: "var(--q-bone2)",
            marginBottom: "4px",
          },
        },
        decision.decision || decision.description,
      ),
    decision.rationale &&
      React.createElement(
        "p",
        {
          style: {
            color: "var(--q-bone0)",
            fontStyle: "italic",
            margin: 0,
          },
        },
        decision.rationale,
      ),
  );
}

/**
 * AssignmentPane component - collapsible right sidebar showing assignment details + job chain
 * WP-8: Transformed to Q palette with copper texture styling
 * @param {Object} props
 * @param {Object} props.assignment - Assignment data
 * @param {string} props.assignmentId - Assignment ID for two-tier job chain subscription
 * @param {boolean} props.isOpen - Whether the pane is open
 * @param {Function} props.onClose - Callback to close the pane
 * @param {Function} props.onJobSelect - Callback when a job is selected
 * @param {Object} props.responsive - Responsive mode info (WP-5)
 * @param {Function} props.onUpdateStatus - Callback to update assignment status (WP-7 U5)
 * @param {Function} props.onChangeFocusAssignment - Callback to change focused assignment (WP-7 U6)
 * @param {Object} props.thread - Thread object for multi-assignment navigation (WP-7 U6)
 * @param {Function} props.onKillJob - Callback to kill a running job (WP-7 R1)
 */
export function AssignmentPane({
  assignment,
  assignmentId,
  isOpen,
  onClose,
  onJobSelect,
  responsive,
  onUpdateStatus,
  onChangeFocusAssignment,
  thread,
  onKillJob,
  onUpdateNudge,
}) {
  // Two-tier subscription: archive (terminal) + live (active) groups
  const groups = useGroupJobsTwoTier(assignmentId);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [northStarOpen, setNorthStarOpen] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [nudgeText, setNudgeText] = useState("");
  const [nudgeEditing, setNudgeEditing] = useState(false);
  const [nudgeSaveHovered, setNudgeSaveHovered] = useState(false);
  const [nudgeClearHovered, setNudgeClearHovered] = useState(false);

  // Sync nudge text with assignment data
  useEffect(() => {
    if (!nudgeEditing) {
      setNudgeText(assignment?.pmNudge || "");
    }
  }, [assignment?.pmNudge, nudgeEditing]);

  // Parse artifacts and decisions from JSON strings
  const artifactList = useMemo(
    () => parseJson(assignment?.artifacts),
    [assignment?.artifacts],
  );
  const decisionList = useMemo(
    () => parseJson(assignment?.decisions),
    [assignment?.decisions],
  );

  // Compute total job count across all groups
  const totalJobCount = useMemo(() => {
    return groups.reduce((sum, group) => sum + (group.jobs?.length || 0), 0);
  }, [groups]);

  if (!assignment) return null;

  const { _id, northStar, status, blockedReason, independent } = assignment;

  const shortId = _id ? _id.slice(-8) : "unknown";

  // When collapsed, hide content from accessibility tree and prevent focus
  const isCollapsed = !isOpen;

  return React.createElement(
    "div",
    {
      id: "assignment-pane",
      className: `assignment-pane flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? "" : "collapsed"
      }`,
      style: {
        borderLeft: "1px solid var(--q-stone3)",
        backgroundColor: "var(--q-stone0)",
      },
      "aria-hidden": isCollapsed ? "true" : undefined,
    },
    // When collapsed, add tabindex=-1 and inert-like behavior to prevent focus trap
    React.createElement(
      "div",
      {
        className: "assignment-pane-inner h-full flex flex-col overflow-hidden",
        tabIndex: isCollapsed ? -1 : undefined,
        // CSS will handle visibility:hidden for collapsed state to fully remove from tab order
        style: isCollapsed ? { visibility: "hidden" } : undefined,
      },
      // Header with close button - Q palette styling
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--q-stone3)",
            backgroundColor: "var(--q-stone1)",
            flexShrink: 0,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: 0,
              flex: 1,
            },
          },
          React.createElement(
            "h2",
            {
              style: {
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--q-bone4)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "var(--font-display)",
                margin: 0,
              },
            },
            "Assignment",
          ),
          React.createElement(
            "code",
            {
              style: {
                fontSize: "12px",
                color: "var(--q-bone0)",
                fontFamily: "var(--font-console)",
              },
            },
            shortId,
          ),
          // WP-7 U5: Status pill dropdown
          onUpdateStatus &&
            React.createElement(StatusPill, {
              status: status,
              onChangeStatus: onUpdateStatus,
            }),
          // WP-7 U6: Multi-assignment navigation
          onChangeFocusAssignment &&
            React.createElement(AssignmentNav, {
              thread: thread,
              assignmentId: _id,
              onChangeFocusAssignment: onChangeFocusAssignment,
            }),
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: onClose,
            onMouseEnter: () => setCloseHovered(true),
            onMouseLeave: () => setCloseHovered(false),
            style: {
              padding: "6px",
              color: closeHovered ? "var(--q-copper2)" : "var(--q-bone1)",
              backgroundColor: closeHovered ? "var(--q-stone2)" : "transparent",
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              transition: "all var(--t-anim-transition-fast)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            title: "Close pane",
          },
          React.createElement(CloseIcon),
        ),
      ),

      // Scrollable content
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          },
        },
        // North Star (collapsible - collapsed by default)
        React.createElement(
          "div",
          null,
          React.createElement(SectionHeader, {
            title: "North Star",
            isOpen: northStarOpen,
            onToggle: () => setNorthStarOpen(!northStarOpen),
          }),
          northStarOpen &&
            React.createElement(
              "p",
              {
                style: {
                  fontSize: "14px",
                  color: "var(--q-bone2)",
                  whiteSpace: "pre-wrap",
                  lineHeight: "var(--t-type-leading-relaxed)",
                  fontFamily: "var(--font-body)",
                  margin: 0,
                  marginTop: "8px",
                },
              },
              northStar || "No description provided",
            ),
        ),

        // PM Nudge - inline editable field
        onUpdateNudge &&
          React.createElement(
            "div",
            {
              style: {
                padding: "10px",
                backgroundColor: nudgeText ? "rgba(212, 160, 48, 0.06)" : "var(--q-stone1)",
                border: nudgeText ? "1px solid rgba(212, 160, 48, 0.25)" : "1px solid var(--q-stone3)",
                borderRadius: 0,
              },
            },
            React.createElement(
              "h3",
              {
                style: {
                  fontSize: "10px",
                  fontWeight: 600,
                  color: nudgeText ? "var(--q-torch)" : "var(--q-bone1)",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: "var(--font-display)",
                  marginBottom: "6px",
                },
              },
              "PM Nudge",
            ),
            React.createElement("textarea", {
              value: nudgeText,
              onChange: (e) => { setNudgeText(e.target.value); setNudgeEditing(true); },
              onBlur: () => { if (!nudgeText && !assignment?.pmNudge) setNudgeEditing(false); },
              placeholder: "No active nudge",
              rows: 2,
              style: {
                width: "100%",
                padding: "6px 8px",
                fontFamily: "var(--font-console)",
                fontSize: "12px",
                color: "var(--q-bone3)",
                backgroundColor: "var(--q-stone2)",
                border: "1px solid var(--q-stone3)",
                borderRadius: 0,
                resize: "vertical",
                lineHeight: "1.4",
                boxSizing: "border-box",
              },
            }),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: "6px",
                  marginTop: "6px",
                  justifyContent: "flex-end",
                },
              },
              // Clear button (only show when nudge exists)
              (nudgeText || assignment?.pmNudge) &&
                React.createElement(
                  "button",
                  {
                    type: "button",
                    onClick: () => { setNudgeText(""); setNudgeEditing(false); onUpdateNudge(""); },
                    onMouseEnter: () => setNudgeClearHovered(true),
                    onMouseLeave: () => setNudgeClearHovered(false),
                    style: {
                      padding: "3px 10px",
                      fontFamily: "var(--font-display)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: nudgeClearHovered ? "var(--q-lava1)" : "var(--q-bone1)",
                      backgroundColor: "transparent",
                      border: "1px solid " + (nudgeClearHovered ? "var(--q-lava1)" : "var(--q-stone3)"),
                      borderRadius: 0,
                      cursor: "pointer",
                      transition: "all var(--t-anim-transition-fast)",
                    },
                  },
                  "Clear",
                ),
              // Save button (only show when editing and text differs from saved)
              nudgeEditing && nudgeText !== (assignment?.pmNudge || "") &&
                React.createElement(
                  "button",
                  {
                    type: "button",
                    onClick: () => { setNudgeEditing(false); onUpdateNudge(nudgeText); },
                    onMouseEnter: () => setNudgeSaveHovered(true),
                    onMouseLeave: () => setNudgeSaveHovered(false),
                    style: {
                      padding: "3px 10px",
                      fontFamily: "var(--font-display)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: nudgeSaveHovered ? "var(--q-torch)" : "var(--q-copper2)",
                      backgroundColor: "transparent",
                      border: "1px solid " + (nudgeSaveHovered ? "var(--q-torch)" : "var(--q-copper1)"),
                      borderRadius: 0,
                      cursor: "pointer",
                      transition: "all var(--t-anim-transition-fast)",
                    },
                  },
                  "Save",
                ),
            ),
          ),

        // Blocked reason - Q lava palette for danger state
        status === "blocked" &&
          blockedReason &&
          React.createElement(
            "div",
            {
              style: {
                padding: "12px",
                backgroundColor: "var(--q-lava0-08)",
                border: "1px solid var(--q-lava1-44)",
                borderRadius: 0,
              },
            },
            React.createElement(
              "h3",
              {
                style: {
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "var(--q-lava1)",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: "var(--font-display)",
                  marginBottom: "4px",
                },
              },
              "Blocked Reason",
            ),
            React.createElement(
              "p",
              {
                style: {
                  fontSize: "14px",
                  color: "var(--q-bone3)",
                  margin: 0,
                },
              },
              blockedReason,
            ),
          ),

        // Job Chain
        groups.length > 0 &&
          React.createElement(JobChain, {
            groups,
            onJobSelect,
            layout: "vertical",
            assignmentStatus: status,
            independent,
            onKillJob,
          }),

        // Artifacts (collapsible)
        artifactList.length > 0 &&
          React.createElement(
            "div",
            null,
            React.createElement(SectionHeader, {
              title: "Artifacts",
              count: artifactList.length,
              isOpen: artifactsOpen,
              onToggle: () => setArtifactsOpen(!artifactsOpen),
            }),
            artifactsOpen &&
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "8px",
                  },
                },
                artifactList.map((artifact, i) =>
                  React.createElement(ArtifactItem, { key: i, artifact }),
                ),
              ),
          ),

        // Decisions (collapsible)
        decisionList.length > 0 &&
          React.createElement(
            "div",
            null,
            React.createElement(SectionHeader, {
              title: "Decisions",
              count: decisionList.length,
              isOpen: decisionsOpen,
              onToggle: () => setDecisionsOpen(!decisionsOpen),
            }),
            decisionsOpen &&
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "8px",
                  },
                },
                decisionList.map((decision, i) =>
                  React.createElement(DecisionItem, {
                    key: i,
                    decision,
                    index: i,
                  }),
                ),
              ),
          ),
      ),
    ),
  );
}

export default AssignmentPane;
