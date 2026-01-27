// AssignmentList - List of assignments for a namespace
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '../../hooks/useConvex.js';
import { api } from '../../api.js';
import { LoadingSkeleton, LoadingSpinner } from '../shared/LoadingSkeleton.js';
import { EmptyState } from '../shared/EmptyState.js';
import { AssignmentCard } from './AssignmentCard.js';

/**
 * Search icon component
 */
function SearchIcon() {
  return React.createElement('svg', {
    className: 'w-4 h-4 text-gray-500',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '2'
  },
    React.createElement('path', {
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
    })
  );
}

/**
 * Status filter tabs component
 * D1: Status filter persistence per namespace (component state)
 */
function StatusFilterTabs({ activeFilter, onFilterChange, counts }) {
  const filters = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'blocked', label: 'Blocked', count: counts.blocked },
    { key: 'complete', label: 'Complete', count: counts.complete }
  ];

  return React.createElement('div', {
    className: 'flex flex-wrap gap-1 mb-4'
  },
    filters.map(filter =>
      React.createElement('button', {
        key: filter.key,
        onClick: () => onFilterChange(filter.key),
        className: `px-3 py-1.5 text-sm rounded-lg transition-colors ${
          activeFilter === filter.key
            ? 'bg-blue-500 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
        }`
      },
        filter.label,
        filter.count > 0 && React.createElement('span', {
          className: `ml-1.5 text-xs ${
            activeFilter === filter.key ? 'text-blue-200' : 'text-gray-500'
          }`
        }, `(${filter.count})`)
      )
    )
  );
}

/**
 * Sort assignments by status priority then timestamp
 */
function sortAssignments(items) {
  const statusPriority = {
    blocked: 0,
    running: 1,
    active: 2,
    pending: 3,
    complete: 4
  };

  return [...items].sort((a, b) => {
    const aPriority = statusPriority[a.assignment.status] ?? 5;
    const bPriority = statusPriority[b.assignment.status] ?? 5;

    if (aPriority !== bPriority) return aPriority - bPriority;

    // Then by updatedAt descending (most recent first)
    return (b.assignment.updatedAt || 0) - (a.assignment.updatedAt || 0);
  });
}

/**
 * AssignmentList component - displays assignments for a namespace
 * D2: Show all assignments with filter option
 * @param {Object} props
 * @param {string} props.namespace - Namespace name to show assignments for
 * @param {Function} props.onSelectAssignment - Callback when assignment is selected
 * @param {string} props.selectedAssignmentId - Currently selected assignment ID
 */
export function AssignmentList({ namespace, onSelectAssignment, selectedAssignmentId }) {
  // D1: Status filter state per namespace (resets when namespace changes via key)
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // D2: Fetch ALL assignments (including complete) with job chains
  const { data: queueData, loading, error } = useQuery(
    api.scheduler.getAllAssignments,
    { namespace }
  );

  // Calculate counts for filter tabs
  const counts = useMemo(() => {
    if (!queueData) return { all: 0, pending: 0, active: 0, blocked: 0, complete: 0 };

    const result = { all: queueData.length, pending: 0, active: 0, blocked: 0, complete: 0 };
    for (const item of queueData) {
      const status = item.assignment.status;
      if (result[status] !== undefined) {
        result[status]++;
      }
    }
    return result;
  }, [queueData]);

  // Filter and sort assignments
  const filteredAssignments = useMemo(() => {
    if (!queueData) return [];

    let filtered = queueData;

    // Apply status filter (D2: show all with filter option)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.assignment.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const assignment = item.assignment;
        return (
          assignment._id?.toLowerCase().includes(term) ||
          assignment.northStar?.toLowerCase().includes(term)
        );
      });
    }

    return sortAssignments(filtered);
  }, [queueData, statusFilter, searchTerm]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleFilterChange = useCallback((filter) => {
    setStatusFilter(filter);
  }, []);

  // Loading state
  if (loading && !queueData) {
    return React.createElement('div', { className: 'p-6' },
      React.createElement('div', { className: 'mb-4' },
        React.createElement('div', { className: 'skeleton h-9 w-full rounded mb-4' }),
        React.createElement('div', { className: 'flex gap-2' },
          React.createElement('div', { className: 'skeleton h-8 w-16 rounded-lg' }),
          React.createElement('div', { className: 'skeleton h-8 w-20 rounded-lg' }),
          React.createElement('div', { className: 'skeleton h-8 w-18 rounded-lg' }),
          React.createElement('div', { className: 'skeleton h-8 w-20 rounded-lg' }),
          React.createElement('div', { className: 'skeleton h-8 w-24 rounded-lg' })
        )
      ),
      React.createElement(LoadingSkeleton, { variant: 'card', count: 3 })
    );
  }

  // Error state
  if (error) {
    return React.createElement('div', { className: 'p-6' },
      React.createElement('div', {
        className: 'bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center'
      },
        React.createElement('p', { className: 'text-red-400' }, 'Failed to load assignments'),
        React.createElement('p', { className: 'text-red-500/60 text-sm mt-1' }, error)
      )
    );
  }

  return React.createElement('div', { className: 'p-6' },
    // Search input
    React.createElement('div', { className: 'relative mb-4' },
      React.createElement('div', {
        className: 'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'
      },
        React.createElement(SearchIcon)
      ),
      React.createElement('input', {
        type: 'text',
        value: searchTerm,
        onChange: handleSearchChange,
        placeholder: 'Search by ID or description...',
        className: 'input pl-9 text-sm'
      })
    ),

    // Status filter tabs
    React.createElement(StatusFilterTabs, {
      activeFilter: statusFilter,
      onFilterChange: handleFilterChange,
      counts
    }),

    // Results count
    React.createElement('div', { className: 'text-xs text-gray-500 mb-4' },
      searchTerm || statusFilter !== 'all'
        ? `Showing ${filteredAssignments.length} of ${queueData?.length || 0} assignments`
        : `${queueData?.length || 0} assignments`
    ),

    // Assignment list or empty state
    filteredAssignments.length === 0
      ? React.createElement(EmptyState, {
          icon: searchTerm ? 'search' : 'inbox',
          title: searchTerm
            ? 'No matches found'
            : statusFilter !== 'all'
              ? `No ${statusFilter} assignments`
              : 'No assignments',
          description: searchTerm
            ? `No assignments match "${searchTerm}"`
            : statusFilter !== 'all'
              ? `There are no ${statusFilter} assignments in this namespace`
              : 'This namespace has no assignments yet'
        })
      : React.createElement('div', { className: 'space-y-4' },
          filteredAssignments.map(item =>
            React.createElement(AssignmentCard, {
              key: item.assignment._id,
              assignment: item.assignment,
              jobs: item.jobs || [],
              isSelected: selectedAssignmentId === item.assignment._id,
              onClick: () => onSelectAssignment && onSelectAssignment(item)
            })
          )
        )
  );
}

export default AssignmentList;
