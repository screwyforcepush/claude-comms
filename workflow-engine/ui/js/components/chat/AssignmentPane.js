// AssignmentPane - Collapsible right sidebar showing assignment details + job chain
// WP-8: Transformed to Q palette brandkit styling
import React, { useState, useMemo } from "react";
import { useQuery } from "../../hooks/useConvex.js";
import { api } from "../../api.js";
import { StatusBadge } from "../shared/StatusBadge.js";
import { JobChain } from "../job/JobChain.js";
import { JsonViewer } from "../shared/JsonViewer.js";
import { QIcon } from "../shared/index.js";

/**
 * Hook to subscribe to jobs for each group in the chain
 * Each group gets its own jobs.list subscription
 */
function useGroupJobs(chainGroups) {
  // Subscribe to jobs for up to 20 groups (practical limit)
  // We use individual useQuery calls - React hooks must be called unconditionally
  const g0 = chainGroups[0];
  const g1 = chainGroups[1];
  const g2 = chainGroups[2];
  const g3 = chainGroups[3];
  const g4 = chainGroups[4];
  const g5 = chainGroups[5];
  const g6 = chainGroups[6];
  const g7 = chainGroups[7];
  const g8 = chainGroups[8];
  const g9 = chainGroups[9];

  const r0 = useQuery(g0 ? api.jobs.list : null, g0 ? { groupId: g0._id } : {});
  const r1 = useQuery(g1 ? api.jobs.list : null, g1 ? { groupId: g1._id } : {});
  const r2 = useQuery(g2 ? api.jobs.list : null, g2 ? { groupId: g2._id } : {});
  const r3 = useQuery(g3 ? api.jobs.list : null, g3 ? { groupId: g3._id } : {});
  const r4 = useQuery(g4 ? api.jobs.list : null, g4 ? { groupId: g4._id } : {});
  const r5 = useQuery(g5 ? api.jobs.list : null, g5 ? { groupId: g5._id } : {});
  const r6 = useQuery(g6 ? api.jobs.list : null, g6 ? { groupId: g6._id } : {});
  const r7 = useQuery(g7 ? api.jobs.list : null, g7 ? { groupId: g7._id } : {});
  const r8 = useQuery(g8 ? api.jobs.list : null, g8 ? { groupId: g8._id } : {});
  const r9 = useQuery(g9 ? api.jobs.list : null, g9 ? { groupId: g9._id } : {});

  const results = [r0, r1, r2, r3, r4, r5, r6, r7, r8, r9];

  return useMemo(() => {
    return chainGroups.map((group, i) => {
      if (i >= 10) return { ...group, jobs: [] };
      return { ...group, jobs: results[i]?.data || [] };
    });
  }, [chainGroups, ...results.map(r => r.data)]);
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
              borderRadius: "9999px",
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
              borderRadius: "9999px",
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
 * @param {Array} props.chainGroups - Group chain (groups without jobs, from getGroupChain)
 * @param {boolean} props.isOpen - Whether the pane is open
 * @param {Function} props.onClose - Callback to close the pane
 * @param {Function} props.onJobSelect - Callback when a job is selected
 * @param {Object} props.responsive - Responsive mode info (WP-5)
 */
export function AssignmentPane({
  assignment,
  chainGroups = [],
  isOpen,
  onClose,
  onJobSelect,
  responsive,
}) {
  // Subscribe to jobs per group individually
  const groups = useGroupJobs(chainGroups);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [northStarOpen, setNorthStarOpen] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

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
            "Assignment Details",
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
        // Status badges
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            },
          },
          React.createElement(StatusBadge, { status, size: "sm" }),
          independent &&
            React.createElement(
              "span",
              {
                style: {
                  fontSize: "12px",
                  backgroundColor: "rgba(92, 60, 124, 0.15)",
                  color: "var(--q-teleport-bright)",
                  border: "1px solid rgba(124, 88, 160, 0.44)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                },
              },
              "Independent",
            ),
        ),

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
