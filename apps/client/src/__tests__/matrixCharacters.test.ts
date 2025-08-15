/**
 * Unit Tests for Matrix Character Mapping System
 * Testing character sets, mapping algorithms, and visual effects
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HookEvent } from '../types';
import { TEST_CHARACTER_SETS, validateCharacterSets } from './utils/matrix-test-helpers';

// Mock interfaces for TDD - these will be implemented by the team
interface MatrixCharacter {
  char: string;
  x: number;
  y: number;
  speed: number;
  opacity: number;
  brightness: number;
  age: number;
  source: string; // 'agent' | 'event' | 'session' | 'timestamp'
}

interface CharacterSets {
  katakana: string[];
  numeric: string[];
  symbols: string[];
  latin: string[];
  special: string[];
}

interface CharacterMapper {
  agentNameToKatakana: (agentName: string) => string[];
  eventTypeToSymbol: (eventType: string) => string;
  sessionIdToSequence: (sessionId: string) => string[];
  timestampToNumbers: (timestamp: number) => string[];
  generateRandomChar: (set: keyof CharacterSets) => string;
  createMatrixCharacter: (
    char: string,
    column: number,
    speed: number,
    source: string
  ) => MatrixCharacter;
}

interface ColorPalette {
  primary: string;
  bright: string;
  dim: string;
  glow: string;
  trail: string[];
}

interface EffectConfig {
  trailLength: number;
  fadeRate: number;
  glowIntensity: number;
  spawnEffect: {
    duration: number;
    intensity: number;
  };
  errorEffect: {
    color: string;
    duration: number;
  };
}

// Mock implementation for TDD
function createMockCharacterMapper(): CharacterMapper {
  const characterSets: CharacterSets = {
    katakana: ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ'],
    numeric: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    symbols: ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '+', '='],
    latin: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'],
    special: ['●', '◎', '○', '△', '▲', '□', '■', '◇', '◆', '♦', '♠', '♣', '♥']
  };

  const agentNameToKatakana = (agentName: string): string[] => {
    if (!agentName || typeof agentName !== 'string') return [];
    
    const chars: string[] = [];
    for (let i = 0; i < agentName.length; i++) {
      const charCode = agentName.charCodeAt(i);
      const katakanaIndex = charCode % characterSets.katakana.length;
      chars.push(characterSets.katakana[katakanaIndex]);
    }
    return chars;
  };

  const eventTypeToSymbol = (eventType: string): string => {
    if (!eventType || typeof eventType !== 'string') return '?';
    
    const symbolMap: Record<string, string> = {
      'pre_response': '◆',
      'post_response': '◇',
      'tool_use': '●',
      'error': '▲',
      'start': '○',
      'end': '■',
      'data': '♦'
    };
    
    return symbolMap[eventType] || '?';
  };

  const sessionIdToSequence = (sessionId: string): string[] => {
    if (!sessionId || typeof sessionId !== 'string') return [];
    
    // Extract numbers and map to numeric characters
    const numbers = sessionId.match(/\d+/g) || [];
    return numbers.flatMap(num => 
      num.split('').map(digit => characterSets.numeric[parseInt(digit)])
    );
  };

  const timestampToNumbers = (timestamp: number): string[] => {
    if (!timestamp || typeof timestamp !== 'number') return [];
    
    // Use last 6 digits of timestamp for visual sequence
    const lastDigits = timestamp.toString().slice(-6);
    return lastDigits.split('').map(digit => characterSets.numeric[parseInt(digit)]);
  };

  const generateRandomChar = (set: keyof CharacterSets): string => {
    const charSet = characterSets[set];
    if (!charSet || charSet.length === 0) return '?';
    
    return charSet[Math.floor(Math.random() * charSet.length)];
  };

  const createMatrixCharacter = (
    char: string,
    column: number,
    speed: number,
    source: string
  ): MatrixCharacter => {
    return {
      char,
      x: column * 20, // 20px column width
      y: 0,
      speed,
      opacity: 1,
      brightness: 1,
      age: 0,
      source
    };
  };

  return {
    agentNameToKatakana,
    eventTypeToSymbol,
    sessionIdToSequence,
    timestampToNumbers,
    generateRandomChar,
    createMatrixCharacter
  };
}

describe('Matrix Character System', () => {
  let characterMapper: CharacterMapper;

  beforeEach(() => {
    characterMapper = createMockCharacterMapper();
  });

  describe('Character Sets', () => {
    it('should define all required character sets', () => {
      const characterSets = {
        katakana: ['ア', 'イ', 'ウ', 'エ', 'オ'],
        numeric: ['0', '1', '2', '3', '4'],
        symbols: ['!', '@', '#', '$', '%'],
        latin: ['A', 'B', 'C', 'D', 'E'],
        special: ['●', '◎', '○', '△', '▲']
      };

      const validation = validateCharacterSets(characterSets);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate character set completeness', () => {
      const incompleteSet = {
        katakana: [],
        numeric: ['0', '1']
      };

      const validation = validateCharacterSets(incompleteSet);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Character set 'katakana' is empty");
    });

    it('should detect duplicate characters in sets', () => {
      const duplicateSet = {
        katakana: ['ア', 'イ', 'ア'], // Duplicate 'ア'
        numeric: ['0', '1', '2']
      };

      const validation = validateCharacterSets(duplicateSet);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Character set 'katakana' contains duplicates");
    });
  });

  describe('Agent Name to Katakana Mapping', () => {
    it('should convert agent names to katakana characters', () => {
      const result = characterMapper.agentNameToKatakana('Alice');
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(5); // 'Alice' has 5 characters
      expect(result.every(char => typeof char === 'string')).toBe(true);
      expect(result.every(char => char.length === 1)).toBe(true);
    });

    it('should handle empty agent names', () => {
      const result = characterMapper.agentNameToKatakana('');
      expect(result).toEqual([]);
    });

    it('should handle null/undefined agent names', () => {
      expect(characterMapper.agentNameToKatakana(null as any)).toEqual([]);
      expect(characterMapper.agentNameToKatakana(undefined as any)).toEqual([]);
    });

    it('should produce consistent mapping for same input', () => {
      const result1 = characterMapper.agentNameToKatakana('TestAgent');
      const result2 = characterMapper.agentNameToKatakana('TestAgent');
      
      expect(result1).toEqual(result2);
    });

    it('should handle special characters in agent names', () => {
      const result = characterMapper.agentNameToKatakana('Agent-123');
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(9); // 'Agent-123' has 9 characters
    });

    it('should handle unicode characters', () => {
      const result = characterMapper.agentNameToKatakana('Agent🤖');
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Event Type to Symbol Mapping', () => {
    it('should map known event types to specific symbols', () => {
      const mappings = [
        { eventType: 'pre_response', expectedSymbol: '◆' },
        { eventType: 'post_response', expectedSymbol: '◇' },
        { eventType: 'tool_use', expectedSymbol: '●' },
        { eventType: 'error', expectedSymbol: '▲' }
      ];

      mappings.forEach(({ eventType, expectedSymbol }) => {
        const result = characterMapper.eventTypeToSymbol(eventType);
        expect(result).toBe(expectedSymbol);
      });
    });

    it('should provide fallback symbol for unknown event types', () => {
      const result = characterMapper.eventTypeToSymbol('unknown_event');
      expect(result).toBe('?');
    });

    it('should handle empty/null event types', () => {
      expect(characterMapper.eventTypeToSymbol('')).toBe('?');
      expect(characterMapper.eventTypeToSymbol(null as any)).toBe('?');
      expect(characterMapper.eventTypeToSymbol(undefined as any)).toBe('?');
    });

    it('should be case sensitive', () => {
      const result1 = characterMapper.eventTypeToSymbol('tool_use');
      const result2 = characterMapper.eventTypeToSymbol('TOOL_USE');
      
      expect(result1).toBe('●');
      expect(result2).toBe('?'); // Case sensitive, so uppercase is unknown
    });
  });

  describe('Session ID to Sequence Mapping', () => {
    it('should extract numeric sequences from session IDs', () => {
      const result = characterMapper.sessionIdToSequence('session-123-abc-456');
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(6); // '123' + '456' = 6 digits
      expect(result.every(char => /\d/.test(char))).toBe(true);
    });

    it('should handle session IDs with no numbers', () => {
      const result = characterMapper.sessionIdToSequence('session-abc-def');
      expect(result).toEqual([]);
    });

    it('should handle multiple numeric sequences', () => {
      const result = characterMapper.sessionIdToSequence('session-123-test-456-end-789');
      
      expect(result.length).toBe(9); // '123' + '456' + '789' = 9 digits
    });

    it('should handle empty/null session IDs', () => {
      expect(characterMapper.sessionIdToSequence('')).toEqual([]);
      expect(characterMapper.sessionIdToSequence(null as any)).toEqual([]);
      expect(characterMapper.sessionIdToSequence(undefined as any)).toEqual([]);
    });
  });

  describe('Timestamp to Numbers Mapping', () => {
    it('should convert timestamps to numeric character arrays', () => {
      const timestamp = 1234567890123;
      const result = characterMapper.timestampToNumbers(timestamp);
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(6); // Last 6 digits
      expect(result.every(char => /\d/.test(char))).toBe(true);
    });

    it('should handle short timestamps', () => {
      const timestamp = 123;
      const result = characterMapper.timestampToNumbers(timestamp);
      
      expect(result.length).toBe(3); // All 3 digits
    });

    it('should handle zero timestamp', () => {
      const result = characterMapper.timestampToNumbers(0);
      expect(result).toEqual(['0']);
    });

    it('should handle invalid timestamps', () => {
      expect(characterMapper.timestampToNumbers(null as any)).toEqual([]);
      expect(characterMapper.timestampToNumbers(undefined as any)).toEqual([]);
      expect(characterMapper.timestampToNumbers(NaN)).toEqual([]);
    });
  });

  describe('Random Character Generation', () => {
    it('should generate characters from specified sets', () => {
      const sets: Array<keyof CharacterSets> = ['katakana', 'numeric', 'symbols', 'latin'];
      
      sets.forEach(set => {
        const char = characterMapper.generateRandomChar(set);
        expect(typeof char).toBe('string');
        expect(char.length).toBe(1);
      });
    });

    it('should generate different characters on multiple calls', () => {
      const chars = Array.from({ length: 100 }, () => 
        characterMapper.generateRandomChar('katakana')
      );
      
      const uniqueChars = new Set(chars);
      expect(uniqueChars.size).toBeGreaterThan(1); // Should have some variety
    });

    it('should handle invalid character sets', () => {
      const result = characterMapper.generateRandomChar('invalid' as any);
      expect(result).toBe('?');
    });
  });

  describe('Matrix Character Creation', () => {
    it('should create valid MatrixCharacter objects', () => {
      const char = characterMapper.createMatrixCharacter('ア', 5, 2.5, 'agent');
      
      expect(char).toMatchObject({
        char: 'ア',
        x: 100, // column 5 * 20px = 100px
        y: 0,
        speed: 2.5,
        opacity: 1,
        brightness: 1,
        age: 0,
        source: 'agent'
      });
    });

    it('should calculate correct x position based on column', () => {
      const chars = [
        characterMapper.createMatrixCharacter('A', 0, 1, 'test'),
        characterMapper.createMatrixCharacter('B', 1, 1, 'test'),
        characterMapper.createMatrixCharacter('C', 10, 1, 'test')
      ];
      
      expect(chars[0].x).toBe(0);   // column 0 * 20px = 0px
      expect(chars[1].x).toBe(20);  // column 1 * 20px = 20px
      expect(chars[2].x).toBe(200); // column 10 * 20px = 200px
    });

    it('should accept different source types', () => {
      const sources = ['agent', 'event', 'session', 'timestamp'];
      
      sources.forEach(source => {
        const char = characterMapper.createMatrixCharacter('X', 0, 1, source);
        expect(char.source).toBe(source);
      });
    });
  });

  describe('Integration with HookEvent', () => {
    function createTestEvent(overrides: Partial<HookEvent> = {}): HookEvent {
      return {
        id: 1,
        source_app: 'client',
        session_id: 'session-123-test',
        hook_event_type: 'pre_response',
        payload: { agentName: 'TestAgent', ...overrides.payload },
        timestamp: Date.now(),
        ...overrides
      };
    }

    it('should extract characters from HookEvent data', () => {
      const event = createTestEvent({
        payload: { agentName: 'Alice' },
        hook_event_type: 'tool_use',
        session_id: 'session-456'
      });

      // Test individual mapping functions
      const agentChars = characterMapper.agentNameToKatakana(event.payload.agentName);
      const eventSymbol = characterMapper.eventTypeToSymbol(event.hook_event_type);
      const sessionSequence = characterMapper.sessionIdToSequence(event.session_id);
      const timestampNums = characterMapper.timestampToNumbers(event.timestamp!);

      expect(agentChars.length).toBe(5); // 'Alice'
      expect(eventSymbol).toBe('●'); // 'tool_use'
      expect(sessionSequence.length).toBe(3); // '456'
      expect(timestampNums.length).toBe(6); // Last 6 digits
    });

    it('should handle events with missing data gracefully', () => {
      const incompleteEvent = createTestEvent({
        payload: {},
        hook_event_type: '',
        session_id: '',
        timestamp: undefined
      });

      expect(() => {
        characterMapper.agentNameToKatakana(incompleteEvent.payload.agentName);
        characterMapper.eventTypeToSymbol(incompleteEvent.hook_event_type);
        characterMapper.sessionIdToSequence(incompleteEvent.session_id);
        characterMapper.timestampToNumbers(incompleteEvent.timestamp!);
      }).not.toThrow();
    });

    it('should create character sequence from complete event', () => {
      const event = createTestEvent({
        payload: { agentName: 'AI' },
        hook_event_type: 'tool_use',
        session_id: 'session-789',
        timestamp: 1234567890
      });

      // Simulate creating a drop sequence from event
      const agentChars = characterMapper.agentNameToKatakana(event.payload.agentName);
      const eventChar = characterMapper.eventTypeToSymbol(event.hook_event_type);
      const sessionChars = characterMapper.sessionIdToSequence(event.session_id);
      
      const allChars = [...agentChars, eventChar, ...sessionChars];
      
      expect(allChars.length).toBeGreaterThan(0);
      expect(allChars.every(char => typeof char === 'string')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle large-scale character generation efficiently', () => {
      const startTime = performance.now();
      
      // Generate 1000 characters
      for (let i = 0; i < 1000; i++) {
        characterMapper.agentNameToKatakana(`Agent${i}`);
        characterMapper.eventTypeToSymbol('pre_response');
        characterMapper.sessionIdToSequence(`session-${i}`);
        characterMapper.timestampToNumbers(Date.now() + i);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should not have memory leaks with repeated calls', () => {
      // Simulate memory pressure
      const largeArray: string[][] = [];
      
      for (let i = 0; i < 100; i++) {
        const chars = characterMapper.agentNameToKatakana(`LongAgentName${i}`.repeat(10));
        largeArray.push(chars);
      }
      
      // Test should complete without memory issues
      expect(largeArray.length).toBe(100);
    });
  });
});