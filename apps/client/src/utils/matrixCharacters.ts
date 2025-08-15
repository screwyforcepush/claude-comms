/**
 * Matrix Character Pool and Mapping System
 * 
 * Provides character sets, mapping utilities, and visual effects for Matrix mode.
 * Implements WP3 - Character System & Visual Effects requirements.
 * 
 * @author SusanVisual
 * @team JohnState, MarkCanvas, DaveTransform, EricSocket, PaulArch, NancyTest
 */

import type { HookEvent } from '../types';
import { matrixModeTokens } from './matrixDesignTokens';

// ============================================================================
// CHARACTER SETS (from design tokens)
// ============================================================================

export const MatrixCharacterSets = {
  // Katakana characters for agent names
  katakana: [
    'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
    'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
    'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ',
    'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン'
  ] as const,

  // Special symbols for event types and status
  symbols: {
    start: '◢',
    complete: '◆',
    error: '⚠',
    spawn: '↕',
    in_progress: '◐',
    success: '✓',
    pending: '⧗',
    data: '◊',
    message: '◈'
  } as const,

  // Numeric characters for timestamps and IDs
  numeric: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const,

  // Alphanumeric for general content
  alphanumeric: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ] as const
} as const;

// ============================================================================
// CHARACTER POOL CLASS
// ============================================================================

export class MatrixCharacterPool {
  private readonly katakanaPool: readonly string[];
  private readonly symbolsPool: Record<string, string>;
  private readonly numericPool: readonly string[];
  private readonly alphanumericPool: readonly string[];
  private agentNameCache = new Map<string, string[]>();

  constructor() {
    this.katakanaPool = MatrixCharacterSets.katakana;
    this.symbolsPool = MatrixCharacterSets.symbols;
    this.numericPool = MatrixCharacterSets.numeric;
    this.alphanumericPool = MatrixCharacterSets.alphanumeric;
  }

  /**
   * Get a random character from the specified set
   */
  getRandomCharacter(set: 'katakana' | 'numeric' | 'alphanumeric'): string {
    switch (set) {
      case 'katakana':
        return this.katakanaPool[Math.floor(Math.random() * this.katakanaPool.length)];
      case 'numeric':
        return this.numericPool[Math.floor(Math.random() * this.numericPool.length)];
      case 'alphanumeric':
        return this.alphanumericPool[Math.floor(Math.random() * this.alphanumericPool.length)];
      default:
        throw new Error(`Unknown character set: ${set}`);
    }
  }

  /**
   * Get a symbol for a specific event type or status
   */
  getSymbol(type: 'start' | 'complete' | 'error' | 'spawn' | 'in_progress' | 'success' | 'pending' | 'data' | 'message'): string {
    return this.symbolsPool[type] || this.symbolsPool.data;
  }

  /**
   * Convert agent name to consistent katakana representation
   */
  agentNameToKatakana(agentName: string): string[] {
    if (this.agentNameCache.has(agentName)) {
      return this.agentNameCache.get(agentName)!;
    }

    const chars: string[] = [];
    const nameChars = agentName.toLowerCase().split('');
    
    // Map common letters to katakana equivalents (only using base katakana set)
    const letterToKatakana: Record<string, string> = {
      'a': 'ア', 'e': 'エ', 'i': 'イ', 'o': 'オ', 'u': 'ウ',
      'k': 'カ', 'g': 'ク', 's': 'サ', 'z': 'ス', 't': 'タ',
      'd': 'ト', 'n': 'ナ', 'h': 'ハ', 'b': 'ホ', 'p': 'ホ',
      'm': 'マ', 'y': 'ヤ', 'r': 'ラ', 'w': 'ワ', 'v': 'ワ'
    };

    for (const char of nameChars) {
      if (letterToKatakana[char]) {
        chars.push(letterToKatakana[char]);
      } else if (/[a-z]/.test(char)) {
        // Fallback to random katakana for unmapped letters
        chars.push(this.getRandomCharacter('katakana'));
      }
    }

    // Ensure minimum 2 characters, maximum 4
    while (chars.length < 2) {
      chars.push(this.getRandomCharacter('katakana'));
    }
    const result = chars.slice(0, 4);
    
    this.agentNameCache.set(agentName, result);
    return result;
  }

  /**
   * Extract numeric characters from timestamp
   */
  timestampToNumbers(timestamp: number): string[] {
    const timestampStr = timestamp.toString();
    // Use last 4 digits for visual variety
    const lastFour = timestampStr.slice(-4);
    return lastFour.split('');
  }

  /**
   * Generate mixed character sequence for general content
   */
  generateMixedSequence(length: number, weights = { katakana: 0.4, numeric: 0.3, alphanumeric: 0.3 }): string[] {
    const sequence: string[] = [];
    
    for (let i = 0; i < length; i++) {
      const rand = Math.random();
      
      if (rand < weights.katakana) {
        sequence.push(this.getRandomCharacter('katakana'));
      } else if (rand < weights.katakana + weights.numeric) {
        sequence.push(this.getRandomCharacter('numeric'));
      } else {
        sequence.push(this.getRandomCharacter('alphanumeric'));
      }
    }
    
    return sequence;
  }

  /**
   * Get all available character sets for external use
   */
  getAllCharacterSets() {
    return {
      katakana: [...this.katakanaPool],
      symbols: { ...this.symbolsPool },
      numeric: [...this.numericPool],
      alphanumeric: [...this.alphanumericPool]
    };
  }
}

// ============================================================================
// EVENT TO CHARACTER MAPPING
// ============================================================================

export interface CharacterMapping {
  agentChars: string[];
  eventSymbol: string;
  timestampChars: string[];
  contentChars: string[];
  totalLength: number;
}

export class EventCharacterMapper {
  private characterPool: MatrixCharacterPool;

  constructor() {
    this.characterPool = new MatrixCharacterPool();
  }

  /**
   * Map a HookEvent to character sequence for Matrix visualization
   */
  mapEventToCharacters(event: HookEvent, trailLength = 15): CharacterMapping {
    // Map agent/session to katakana
    const agentId = event.session_id || 'unknown';
    const agentChars = this.characterPool.agentNameToKatakana(agentId.slice(0, 8));

    // Map event type to symbol
    const eventSymbol = this.getEventTypeSymbol(event.hook_event_type);

    // Map timestamp to numbers
    const timestamp = event.timestamp || Date.now();
    const timestampChars = this.characterPool.timestampToNumbers(timestamp);

    // Calculate remaining length for content
    const usedLength = agentChars.length + 1 + timestampChars.length; // +1 for symbol
    const remainingLength = Math.max(0, trailLength - usedLength);

    // Generate content characters
    const contentChars = remainingLength > 0 
      ? this.characterPool.generateMixedSequence(remainingLength)
      : [];

    return {
      agentChars,
      eventSymbol,
      timestampChars,
      contentChars,
      totalLength: agentChars.length + 1 + timestampChars.length + contentChars.length
    };
  }

  /**
   * Map event type to appropriate symbol
   */
  private getEventTypeSymbol(eventType: string): string {
    const type = eventType.toLowerCase();
    
    if (type.includes('start') || type.includes('begin')) {
      return this.characterPool.getSymbol('start');
    }
    if (type.includes('complete') || type.includes('end') || type.includes('finish')) {
      return this.characterPool.getSymbol('complete');
    }
    if (type.includes('error') || type.includes('fail')) {
      return this.characterPool.getSymbol('error');
    }
    if (type.includes('progress') || type.includes('ongoing')) {
      return this.characterPool.getSymbol('in_progress');
    }
    if (type.includes('success')) {
      return this.characterPool.getSymbol('success');
    }
    if (type.includes('pending') || type.includes('wait')) {
      return this.characterPool.getSymbol('pending');
    }
    if (type.includes('message') || type.includes('chat')) {
      return this.characterPool.getSymbol('message');
    }
    
    // Default to data symbol
    return this.characterPool.getSymbol('data');
  }

  /**
   * Create a full character sequence from mapping
   */
  createCharacterSequence(mapping: CharacterMapping): string[] {
    return [
      ...mapping.agentChars,
      mapping.eventSymbol,
      ...mapping.timestampChars,
      ...mapping.contentChars
    ];
  }

  /**
   * Get character pool for external use
   */
  getCharacterPool(): MatrixCharacterPool {
    return this.characterPool;
  }
}

// ============================================================================
// CHARACTER MUTATION SYSTEM
// ============================================================================

export interface MutationConfig {
  mutationRate: number; // 0-1, probability of character changing per frame
  mutationSpeed: number; // frames between mutations
  stableFrames: number; // frames character stays stable after mutation
}

export class CharacterMutator {
  private characterPool: MatrixCharacterPool;
  private mutationTimers = new Map<string, number>();
  private stableTimers = new Map<string, number>();

  constructor() {
    this.characterPool = new MatrixCharacterPool();
  }

  /**
   * Update character mutations for animation frame
   */
  updateMutations(
    characterId: string, 
    currentChar: string, 
    characterType: 'katakana' | 'numeric' | 'alphanumeric',
    config: MutationConfig
  ): string {
    const mutationTimer = this.mutationTimers.get(characterId) || 0;
    const stableTimer = this.stableTimers.get(characterId) || 0;

    // Check if character is in stable period
    if (stableTimer > 0) {
      this.stableTimers.set(characterId, stableTimer - 1);
      return currentChar;
    }

    // Check if it's time to mutate
    if (mutationTimer <= 0 && Math.random() < config.mutationRate) {
      // Reset timers
      this.mutationTimers.set(characterId, config.mutationSpeed);
      this.stableTimers.set(characterId, config.stableFrames);
      
      // Return new random character of same type
      return this.characterPool.getRandomCharacter(characterType);
    }

    // Update mutation timer
    if (mutationTimer > 0) {
      this.mutationTimers.set(characterId, mutationTimer - 1);
    }

    return currentChar;
  }

  /**
   * Clear mutation state for character
   */
  clearMutationState(characterId: string): void {
    this.mutationTimers.delete(characterId);
    this.stableTimers.delete(characterId);
  }

  /**
   * Get mutation config presets
   */
  static getMutationPresets() {
    return {
      slow: { mutationRate: 0.02, mutationSpeed: 120, stableFrames: 60 },
      medium: { mutationRate: 0.05, mutationSpeed: 60, stableFrames: 30 },
      fast: { mutationRate: 0.1, mutationSpeed: 30, stableFrames: 15 },
      hyperfast: { mutationRate: 0.2, mutationSpeed: 15, stableFrames: 5 }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export singleton instances for global use
export const matrixCharacterPool = new MatrixCharacterPool();
export const eventCharacterMapper = new EventCharacterMapper();
export const characterMutator = new CharacterMutator();

// Export for DaveTransform integration
export const MatrixCharacterApi = {
  characterPool: matrixCharacterPool,
  mapper: eventCharacterMapper,
  mutator: characterMutator,
  sets: MatrixCharacterSets
};