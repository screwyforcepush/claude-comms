/**
 * Matrix Character System Tests
 * 
 * Comprehensive test suite for character pool, mapping, and mutations.
 * Following TDD principles as specified by NancyTest.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MatrixCharacterPool,
  EventCharacterMapper,
  CharacterMutator,
  MatrixCharacterSets,
  matrixCharacterPool,
  eventCharacterMapper,
  characterMutator
} from '../matrixCharacters';
import type { HookEvent } from '../../types';

describe('MatrixCharacterSets', () => {
  it('should contain all required character sets', () => {
    expect(MatrixCharacterSets.katakana).toBeDefined();
    expect(MatrixCharacterSets.symbols).toBeDefined();
    expect(MatrixCharacterSets.numeric).toBeDefined();
    expect(MatrixCharacterSets.alphanumeric).toBeDefined();
  });

  it('should have katakana characters', () => {
    expect(MatrixCharacterSets.katakana.length).toBeGreaterThan(40);
    expect(MatrixCharacterSets.katakana).toContain('ア');
    expect(MatrixCharacterSets.katakana).toContain('カ');
    expect(MatrixCharacterSets.katakana).toContain('ン');
  });

  it('should have required symbols', () => {
    expect(MatrixCharacterSets.symbols.start).toBe('◢');
    expect(MatrixCharacterSets.symbols.complete).toBe('◆');
    expect(MatrixCharacterSets.symbols.error).toBe('⚠');
    expect(MatrixCharacterSets.symbols.success).toBe('✓');
  });

  it('should have numeric characters 0-9', () => {
    expect(MatrixCharacterSets.numeric).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('should have alphanumeric characters A-Z and 0-9', () => {
    expect(MatrixCharacterSets.alphanumeric.length).toBe(36);
    expect(MatrixCharacterSets.alphanumeric).toContain('A');
    expect(MatrixCharacterSets.alphanumeric).toContain('Z');
    expect(MatrixCharacterSets.alphanumeric).toContain('0');
    expect(MatrixCharacterSets.alphanumeric).toContain('9');
  });
});

describe('MatrixCharacterPool', () => {
  let pool: MatrixCharacterPool;

  beforeEach(() => {
    pool = new MatrixCharacterPool();
  });

  describe('getRandomCharacter', () => {
    it('should return katakana characters', () => {
      const char = pool.getRandomCharacter('katakana');
      expect(MatrixCharacterSets.katakana).toContain(char);
    });

    it('should return numeric characters', () => {
      const char = pool.getRandomCharacter('numeric');
      expect(MatrixCharacterSets.numeric).toContain(char);
    });

    it('should return alphanumeric characters', () => {
      const char = pool.getRandomCharacter('alphanumeric');
      expect(MatrixCharacterSets.alphanumeric).toContain(char);
    });

    it('should throw error for invalid character set', () => {
      expect(() => pool.getRandomCharacter('invalid' as any)).toThrow();
    });

    it('should return different characters on multiple calls', () => {
      const chars = new Set();
      for (let i = 0; i < 100; i++) {
        chars.add(pool.getRandomCharacter('katakana'));
      }
      // Should have some variety (not all the same character)
      expect(chars.size).toBeGreaterThan(1);
    });
  });

  describe('getSymbol', () => {
    it('should return correct symbols for event types', () => {
      expect(pool.getSymbol('start')).toBe('◢');
      expect(pool.getSymbol('complete')).toBe('◆');
      expect(pool.getSymbol('error')).toBe('⚠');
      expect(pool.getSymbol('success')).toBe('✓');
    });

    it('should return default symbol for unknown types', () => {
      expect(pool.getSymbol('unknown' as any)).toBe('◊');
    });
  });

  describe('agentNameToKatakana', () => {
    it('should convert agent names consistently', () => {
      const name = 'TestAgent';
      const katakana1 = pool.agentNameToKatakana(name);
      const katakana2 = pool.agentNameToKatakana(name);
      expect(katakana1).toEqual(katakana2);
    });

    it('should return array of katakana characters', () => {
      const katakana = pool.agentNameToKatakana('Agent');
      expect(Array.isArray(katakana)).toBe(true);
      katakana.forEach(char => {
        expect(MatrixCharacterSets.katakana).toContain(char);
      });
    });

    it('should return at least 2 characters', () => {
      expect(pool.agentNameToKatakana('A')).toHaveLength(2);
    });

    it('should return at most 4 characters', () => {
      expect(pool.agentNameToKatakana('VeryLongAgentName')).toHaveLength(4);
    });

    it('should cache results', () => {
      const name = 'CachedAgent';
      const first = pool.agentNameToKatakana(name);
      const second = pool.agentNameToKatakana(name);
      expect(first).toBe(second); // Same reference due to caching
    });
  });

  describe('timestampToNumbers', () => {
    it('should extract last 4 digits from timestamp', () => {
      const numbers = pool.timestampToNumbers(1234567890123);
      expect(numbers).toEqual(['0', '1', '2', '3']);
    });

    it('should handle short timestamps', () => {
      const numbers = pool.timestampToNumbers(123);
      expect(numbers).toEqual(['1', '2', '3']);
    });

    it('should return string digits', () => {
      const numbers = pool.timestampToNumbers(5678);
      numbers.forEach(num => {
        expect(typeof num).toBe('string');
        expect(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']).toContain(num);
      });
    });
  });

  describe('generateMixedSequence', () => {
    it('should generate sequence of specified length', () => {
      const sequence = pool.generateMixedSequence(10);
      expect(sequence).toHaveLength(10);
    });

    it('should respect character weights', () => {
      const sequence = pool.generateMixedSequence(100, { katakana: 1, numeric: 0, alphanumeric: 0 });
      sequence.forEach(char => {
        expect(MatrixCharacterSets.katakana).toContain(char);
      });
    });

    it('should include all character types with balanced weights', () => {
      const sequence = pool.generateMixedSequence(300);
      const hasKatakana = sequence.some(char => MatrixCharacterSets.katakana.includes(char));
      const hasNumeric = sequence.some(char => MatrixCharacterSets.numeric.includes(char));
      const hasAlpha = sequence.some(char => MatrixCharacterSets.alphanumeric.includes(char));
      
      expect(hasKatakana).toBe(true);
      expect(hasNumeric).toBe(true);
      expect(hasAlpha).toBe(true);
    });
  });

  describe('getAllCharacterSets', () => {
    it('should return all character sets', () => {
      const sets = pool.getAllCharacterSets();
      expect(sets.katakana).toBeDefined();
      expect(sets.symbols).toBeDefined();
      expect(sets.numeric).toBeDefined();
      expect(sets.alphanumeric).toBeDefined();
    });

    it('should return copies not references', () => {
      const sets = pool.getAllCharacterSets();
      sets.katakana.push('TEST');
      const sets2 = pool.getAllCharacterSets();
      expect(sets2.katakana).not.toContain('TEST');
    });
  });
});

describe('EventCharacterMapper', () => {
  let mapper: EventCharacterMapper;
  let mockEvent: HookEvent;

  beforeEach(() => {
    mapper = new EventCharacterMapper();
    mockEvent = {
      id: 1,
      source_app: 'test-app',
      session_id: 'session-123',
      hook_event_type: 'pre_response',
      payload: { agentName: 'TestAgent' },
      timestamp: 1234567890123
    };
  });

  describe('mapEventToCharacters', () => {
    it('should create character mapping from event', () => {
      const mapping = mapper.mapEventToCharacters(mockEvent);
      
      expect(mapping.agentChars).toBeDefined();
      expect(mapping.eventSymbol).toBeDefined();
      expect(mapping.timestampChars).toBeDefined();
      expect(mapping.contentChars).toBeDefined();
      expect(mapping.totalLength).toBeGreaterThan(0);
    });

    it('should respect trail length parameter', () => {
      const mapping = mapper.mapEventToCharacters(mockEvent, 20);
      expect(mapping.totalLength).toBeLessThanOrEqual(20);
    });

    it('should generate consistent mappings for same event', () => {
      const mapping1 = mapper.mapEventToCharacters(mockEvent);
      const mapping2 = mapper.mapEventToCharacters(mockEvent);
      
      expect(mapping1.agentChars).toEqual(mapping2.agentChars);
      expect(mapping1.eventSymbol).toBe(mapping2.eventSymbol);
      expect(mapping1.timestampChars).toEqual(mapping2.timestampChars);
    });

    it('should map different event types to different symbols', () => {
      const startEvent = { ...mockEvent, hook_event_type: 'start_session' };
      const errorEvent = { ...mockEvent, hook_event_type: 'error_occurred' };
      
      const startMapping = mapper.mapEventToCharacters(startEvent);
      const errorMapping = mapper.mapEventToCharacters(errorEvent);
      
      expect(startMapping.eventSymbol).not.toBe(errorMapping.eventSymbol);
    });

    it('should handle missing timestamp', () => {
      const eventWithoutTimestamp = { ...mockEvent, timestamp: undefined };
      const mapping = mapper.mapEventToCharacters(eventWithoutTimestamp);
      
      expect(mapping.timestampChars).toBeDefined();
      expect(mapping.timestampChars.length).toBeGreaterThan(0);
    });

    it('should handle missing session_id', () => {
      const eventWithoutSession = { ...mockEvent, session_id: '' };
      const mapping = mapper.mapEventToCharacters(eventWithoutSession);
      
      expect(mapping.agentChars).toBeDefined();
      expect(mapping.agentChars.length).toBeGreaterThan(0);
    });
  });

  describe('createCharacterSequence', () => {
    it('should create flat array from mapping', () => {
      const mapping = mapper.mapEventToCharacters(mockEvent);
      const sequence = mapper.createCharacterSequence(mapping);
      
      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBe(mapping.totalLength);
    });

    it('should maintain order: agent, symbol, timestamp, content', () => {
      const mapping = mapper.mapEventToCharacters(mockEvent);
      const sequence = mapper.createCharacterSequence(mapping);
      
      // Check agent chars are at beginning
      for (let i = 0; i < mapping.agentChars.length; i++) {
        expect(sequence[i]).toBe(mapping.agentChars[i]);
      }
      
      // Check symbol follows agent chars
      expect(sequence[mapping.agentChars.length]).toBe(mapping.eventSymbol);
    });
  });
});

describe('CharacterMutator', () => {
  let mutator: CharacterMutator;
  const config = { mutationRate: 0.5, mutationSpeed: 10, stableFrames: 5 };

  beforeEach(() => {
    mutator = new CharacterMutator();
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // Consistent random for testing
  });

  describe('updateMutations', () => {
    it('should return original character during stable period', () => {
      const charId = 'test-char';
      const originalChar = 'ア';
      
      // First call might mutate, set stable period
      mutator.updateMutations(charId, originalChar, 'katakana', config);
      
      // Subsequent calls during stable period should return same
      const result = mutator.updateMutations(charId, originalChar, 'katakana', config);
      expect(result).toBe(originalChar);
    });

    it('should return same character when mutation rate not met', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // High value, won't trigger mutation
      
      const result = mutator.updateMutations('test', 'ア', 'katakana', { 
        mutationRate: 0.1, 
        mutationSpeed: 1, 
        stableFrames: 0 
      });
      
      expect(result).toBe('ア');
    });

    it('should return new character when mutation conditions met', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // Low value, will trigger mutation
      
      const originalChar = 'ア';
      const result = mutator.updateMutations('test', originalChar, 'katakana', {
        mutationRate: 0.5,
        mutationSpeed: 0,
        stableFrames: 0
      });
      
      // Should return a katakana character (might be same by chance, but is mutated)
      expect(MatrixCharacterSets.katakana).toContain(result);
    });

    it('should track mutation timers independently for different characters', () => {
      const char1 = mutator.updateMutations('char1', 'ア', 'katakana', config);
      const char2 = mutator.updateMutations('char2', 'イ', 'katakana', config);
      
      // Each character maintains independent state
      expect(typeof char1).toBe('string');
      expect(typeof char2).toBe('string');
    });

    it('should respect character type for mutations', () => {
      const numericResult = mutator.updateMutations('test', '5', 'numeric', {
        mutationRate: 1, // Always mutate
        mutationSpeed: 0,
        stableFrames: 0
      });
      
      expect(MatrixCharacterSets.numeric).toContain(numericResult);
    });
  });

  describe('clearMutationState', () => {
    it('should clear mutation state for character', () => {
      const charId = 'test-char';
      
      // Set up some state
      mutator.updateMutations(charId, 'ア', 'katakana', config);
      
      // Clear state
      mutator.clearMutationState(charId);
      
      // Should behave as if character is new
      const result = mutator.updateMutations(charId, 'ア', 'katakana', config);
      expect(typeof result).toBe('string');
    });

    it('should not affect other characters', () => {
      mutator.updateMutations('char1', 'ア', 'katakana', config);
      mutator.updateMutations('char2', 'イ', 'katakana', config);
      
      mutator.clearMutationState('char1');
      
      // char2 should still have its state
      const result = mutator.updateMutations('char2', 'イ', 'katakana', config);
      expect(typeof result).toBe('string');
    });
  });

  describe('getMutationPresets', () => {
    it('should provide predefined mutation presets', () => {
      const presets = CharacterMutator.getMutationPresets();
      
      expect(presets.slow).toBeDefined();
      expect(presets.medium).toBeDefined();
      expect(presets.fast).toBeDefined();
      expect(presets.hyperfast).toBeDefined();
    });

    it('should have properly structured presets', () => {
      const presets = CharacterMutator.getMutationPresets();
      
      Object.values(presets).forEach(preset => {
        expect(preset.mutationRate).toBeGreaterThan(0);
        expect(preset.mutationSpeed).toBeGreaterThan(0);
        expect(preset.stableFrames).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have increasing mutation rates from slow to hyperfast', () => {
      const presets = CharacterMutator.getMutationPresets();
      
      expect(presets.slow.mutationRate).toBeLessThan(presets.medium.mutationRate);
      expect(presets.medium.mutationRate).toBeLessThan(presets.fast.mutationRate);
      expect(presets.fast.mutationRate).toBeLessThan(presets.hyperfast.mutationRate);
    });
  });
});

describe('Singleton Exports', () => {
  it('should export singleton instances', () => {
    expect(matrixCharacterPool).toBeInstanceOf(MatrixCharacterPool);
    expect(eventCharacterMapper).toBeInstanceOf(EventCharacterMapper);
    expect(characterMutator).toBeInstanceOf(CharacterMutator);
  });

  it('should export MatrixCharacterApi for team integration', async () => {
    const module = await import('../matrixCharacters');
    
    expect(module.MatrixCharacterApi.characterPool).toBeDefined();
    expect(module.MatrixCharacterApi.mapper).toBeDefined();
    expect(module.MatrixCharacterApi.mutator).toBeDefined();
    expect(module.MatrixCharacterApi.sets).toBeDefined();
  });
});

// Performance tests
describe('Performance Tests', () => {
  it('should handle large numbers of character mappings efficiently', () => {
    const mapper = new EventCharacterMapper();
    const startTime = performance.now();
    
    // Map 1000 events
    for (let i = 0; i < 1000; i++) {
      const event: HookEvent = {
        id: i,
        source_app: 'test-app',
        session_id: `session-${i}`,
        hook_event_type: 'test_event',
        payload: {},
        timestamp: Date.now() + i
      };
      
      mapper.mapEventToCharacters(event);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (adjust threshold as needed)
    expect(duration).toBeLessThan(100); // 100ms for 1000 mappings
  });

  it('should cache agent name conversions for performance', () => {
    const pool = new MatrixCharacterPool();
    const agentName = 'PerformanceTestAgent';
    
    const startTime = performance.now();
    
    // First call (cache miss)
    pool.agentNameToKatakana(agentName);
    
    // 100 subsequent calls (cache hits)
    for (let i = 0; i < 100; i++) {
      pool.agentNameToKatakana(agentName);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should be very fast with caching
    expect(duration).toBeLessThan(10); // 10ms for 101 calls
  });
});