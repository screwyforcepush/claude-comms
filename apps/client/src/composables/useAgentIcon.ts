/**
 * Composable for determining agent icon based on agent type
 */
export function useAgentIcon() {
  /**
   * Get the icon path for an agent based on their type/subagent_type
   * @param agentType - The type of agent (e.g., 'consultant', 'engineer', etc.)
   * @returns Path to the SVG icon
   */
  const getAgentIconPath = (agentType: string | undefined): string => {
    if (!agentType) {
      return '/anthropic.svg';
    }

    // Consultant agents use OpenAI icon
    if (agentType.toLowerCase() === 'consultant') {
      return '/openai.svg';
    }

    // All other agents use Anthropic icon
    return '/anthropic.svg';
  };

  /**
   * Get icon alt text for accessibility
   * @param agentType - The type of agent
   * @returns Alt text for the icon
   */
  const getAgentIconAlt = (agentType: string | undefined): string => {
    if (!agentType) {
      return 'Anthropic agent';
    }

    if (agentType.toLowerCase() === 'consultant') {
      return 'OpenAI agent';
    }

    return 'Anthropic agent';
  };

  return {
    getAgentIconPath,
    getAgentIconAlt
  };
}
