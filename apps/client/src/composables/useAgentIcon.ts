/**
 * Composable for determining agent icon based on agent type
 */
export function useAgentIcon() {
  /**
   * Get the icon path for an agent based on their type/subagent_type
   * @param agentType - The type of agent (e.g., 'consultant-codex', 'consultant-gemini', 'engineer', etc.)
   * @returns Path to the icon
   */
  const getAgentIconPath = (agentType: string | undefined): string => {
    if (!agentType) {
      return '/anthropic.svg';
    }

    const type = agentType.toLowerCase();

    // Codex agent uses OpenAI icon
    if (type === 'codex') {
      return '/openai.svg';
    }

    // Gemini agent uses Gemini icon
    if (type === 'gemini') {
      return '/gemini.png';
    }

    // Legacy 'consultant' type defaults to OpenAI (Codex)
    if (type === 'consultant') {
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

    const type = agentType.toLowerCase();

    if (type === 'codex' || type === 'consultant') {
      return 'OpenAI Codex agent';
    }

    if (type === 'gemini') {
      return 'Google Gemini agent';
    }

    return 'Anthropic agent';
  };

  return {
    getAgentIconPath,
    getAgentIconAlt
  };
}
