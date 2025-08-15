/**
 * Event to Matrix Drop Transformer
 * 
 * This file contains the core implementation for transforming HookEvents
 * into Matrix drop visualizations. It implements the interfaces defined
 * in types/matrix-mode.ts.
 */

import type { HookEvent } from '../types';
import type {
  EventToDropTransformer,
  TransformerConfig,
  MatrixDrop,
  MatrixDropType,
  MatrixDropEffect,
  CharacterMapper,
  ColumnManager,
  PositionCalculator,
  EventMappingRules,
  EventDataExtraction,
  DropGenerationParams,
  CharacterSets,
  ColorSchemes,
  EffectPresets,
  Position,
  ColumnStats
} from '../types/matrix-mode';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default character sets for Matrix mode
 */
export const DEFAULT_CHARACTER_SETS: CharacterSets = {
  katakana: [
    'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
    'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
    'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ',
    'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン'
  ],
  symbols: ['◆', '◢', '⚠', '↕', '◐', '✓', '●', '○', '▲', '▼', '←', '→', '↑', '↓'],
  numeric: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  alphanumeric: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ],
  matrix: [
    'ｱ', 'ｲ', 'ｳ', 'ｴ', 'ｵ', 'ｶ', 'ｷ', 'ｸ', 'ｹ', 'ｺ', 'ｻ', 'ｼ', 'ｽ', 'ｾ', 'ｿ',
    'ﾀ', 'ﾁ', 'ﾂ', 'ﾃ', 'ﾄ', 'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ', 'ﾊ', 'ﾋ', 'ﾌ', 'ﾍ', 'ﾎ',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]
};

/**
 * Default color schemes
 */
export const DEFAULT_COLOR_SCHEMES: ColorSchemes = {
  standard: {
    head: '#FFFFFF',
    trail: '#00FF00',
    background: '#000000'
  },
  error: {
    head: '#FF3030',
    trail: '#FF6060',
    background: '#330000'
  },
  success: {
    head: '#00FFAA',
    trail: '#00AA55',
    background: '#003322'
  },
  spawn: {
    head: '#00AAFF',
    trail: '#0088CC',
    background: '#002244'
  }
};

/**
 * Default effect presets
 */
export const DEFAULT_EFFECT_PRESETS: EffectPresets = {
  spawn: [
    { type: 'flash', duration: 300, intensity: 1.0, startTime: 0 },
    { type: 'pulse', duration: 800, intensity: 0.8, startTime: 300 }
  ],
  error: [
    { type: 'glow', duration: 1000, intensity: 0.9, startTime: 0 },
    { type: 'accelerate', duration: 500, intensity: 1.5, startTime: 0 }
  ],
  completion: [
    { type: 'pause', duration: 500, intensity: 1.0, startTime: 0 },
    { type: 'flash', duration: 200, intensity: 1.0, startTime: 500 }
  ],
  statusChange: [
    { type: 'pulse', duration: 600, intensity: 0.7, startTime: 0 }
  ]
};

/**
 * Default event mapping rules
 */
export const DEFAULT_MAPPING_RULES: EventMappingRules = {
  speedMap: {
    'pre_response': 1.2,
    'post_response': 1.0,
    'error': 1.8,
    'stream_chunk': 1.1,
    'api_request': 0.9,
    'start': 1.5,
    'complete': 1.3,
    'spawn': 2.0,
    'in_progress': 1.0,
    'pending': 0.8
  },
  colorMap: {
    'error': '#FF3030',
    'complete': '#00FFAA',
    'spawn': '#00AAFF',
    'start': '#FFAA00',
    'in_progress': '#00FF00',
    'pending': '#AAAA00'
  },
  effectMap: {
    'spawn': DEFAULT_EFFECT_PRESETS.spawn,
    'error': DEFAULT_EFFECT_PRESETS.error,
    'complete': DEFAULT_EFFECT_PRESETS.completion,
    'start': DEFAULT_EFFECT_PRESETS.statusChange,
    'in_progress': DEFAULT_EFFECT_PRESETS.statusChange
  },
  statusSymbolMap: {
    'pending': '⧗',
    'in_progress': '◐',
    'completed': '✓',
    'error': '⚠',
    'terminated': '●'
  },
  sessionPriorityMap: {}
};

// ============================================================================
// Character Mapper Implementation
// ============================================================================

export class MatrixCharacterMapper implements CharacterMapper {
  constructor(private characterSets: CharacterSets) {}

  mapAgentName(agentName: string): string[] {
    if (!agentName) return [];
    
    // Convert to katakana approximation
    const result: string[] = [];
    for (const char of agentName.toLowerCase()) {
      if (char >= 'a' && char <= 'z') {
        // Simple mapping to katakana
        const katakanaIndex = char.charCodeAt(0) - 'a'.charCodeAt(0);
        if (katakanaIndex < this.characterSets.katakana.length) {
          result.push(this.characterSets.katakana[katakanaIndex]);
        }
      } else if (char >= 'A' && char <= 'Z') {
        result.push(char);
      }
    }
    return result.slice(0, 3); // Limit to 3 characters
  }

  mapSessionId(sessionId: string): string[] {
    // Take last 6 characters and stylize
    const lastChars = sessionId.slice(-6).toUpperCase();
    return lastChars.split('').map(char => {
      if (this.characterSets.alphanumeric.includes(char)) {
        return char;
      }
      // Replace unknown chars with random alphanumeric
      return this.characterSets.alphanumeric[
        Math.floor(Math.random() * this.characterSets.alphanumeric.length)
      ];
    });
  }

  mapTimestamp(timestamp: number): string[] {
    // Use last 4 digits of timestamp
    const timeStr = timestamp.toString();
    return timeStr.slice(-4).split('');
  }

  mapEventTypeToSymbol(eventType: string): string {
    // Map common event types to symbols
    const symbolMap: Record<string, string> = {
      'start': '◢',
      'complete': '◆', 
      'error': '⚠',
      'spawn': '↕',
      'in_progress': '◐',
      'pending': '⧗',
      'stream_chunk': '○',
      'api_request': '→',
      'response': '←'
    };

    // Find matching symbol or use default
    for (const [key, symbol] of Object.entries(symbolMap)) {
      if (eventType.toLowerCase().includes(key)) {
        return symbol;
      }
    }
    
    return this.characterSets.symbols[0] || '●';
  }

  mapStatusToSymbol(status: string): string {
    const symbolMap: Record<string, string> = {
      'pending': '⧗',
      'in_progress': '◐',
      'completed': '✓',
      'error': '⚠',
      'terminated': '●'
    };
    
    return symbolMap[status.toLowerCase()] || '○';
  }

  generateRandomChars(count: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const randomChar = this.characterSets.matrix[
        Math.floor(Math.random() * this.characterSets.matrix.length)
      ];
      result.push(randomChar);
    }
    return result;
  }
}

// ============================================================================
// Column Manager Implementation
// ============================================================================

export class MatrixColumnManager implements ColumnManager {
  private columnAssignments = new Map<number, string>(); // column -> sessionId
  private sessionColumns = new Map<string, number>(); // sessionId -> column
  private reservedColumns = new Set<number>();

  constructor(private totalColumns: number) {}

  assignColumn(sessionId: string, sourceApp: string, dropType: MatrixDropType): number {
    const sessionKey = `${sessionId}-${sourceApp}`;
    
    // Check if session already has a column
    const existingColumn = this.sessionColumns.get(sessionKey);
    if (existingColumn !== undefined && !this.columnAssignments.has(existingColumn)) {
      this.columnAssignments.set(existingColumn, sessionKey);
      return existingColumn;
    }

    // Find available column using hash for consistency
    const hash = this.hashString(sessionKey);
    const startColumn = hash % this.totalColumns;
    
    for (let i = 0; i < this.totalColumns; i++) {
      const column = (startColumn + i) % this.totalColumns;
      if (!this.columnAssignments.has(column) && !this.reservedColumns.has(column)) {
        this.columnAssignments.set(column, sessionKey);
        this.sessionColumns.set(sessionKey, column);
        return column;
      }
    }

    // If all columns occupied, use hash-based assignment
    const fallbackColumn = hash % this.totalColumns;
    this.columnAssignments.set(fallbackColumn, sessionKey);
    this.sessionColumns.set(sessionKey, fallbackColumn);
    return fallbackColumn;
  }

  releaseColumn(column: number): void {
    const sessionKey = this.columnAssignments.get(column);
    if (sessionKey) {
      this.columnAssignments.delete(column);
      this.sessionColumns.delete(sessionKey);
    }
  }

  getColumnStats(): ColumnStats {
    return {
      total: this.totalColumns,
      occupied: this.columnAssignments.size,
      available: this.totalColumns - this.columnAssignments.size,
      utilization: (this.columnAssignments.size / this.totalColumns) * 100,
      sessionColumns: new Map(this.sessionColumns)
    };
  }

  isColumnAvailable(column: number): boolean {
    return !this.columnAssignments.has(column) && !this.reservedColumns.has(column);
  }

  getOccupiedColumns(): number[] {
    return Array.from(this.columnAssignments.keys());
  }

  reserveColumnForSession(sessionId: string): number {
    const hash = this.hashString(sessionId);
    const column = hash % this.totalColumns;
    this.reservedColumns.add(column);
    return column;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// Position Calculator Implementation
// ============================================================================

export class MatrixPositionCalculator implements PositionCalculator {
  calculateSpawnPosition(column: number, dropType: MatrixDropType): Position {
    // Spawn at top of screen with slight randomization
    const baseY = dropType === 'ambient' ? Math.random() * -100 : -20;
    
    return {
      x: this.getColumnXPosition(column, 20), // Default column width
      y: baseY
    };
  }

  calculateNextPosition(currentPosition: Position, speed: number, deltaTime: number): Position {
    return {
      x: currentPosition.x, // X position doesn't change (vertical falling)
      y: currentPosition.y + (speed * deltaTime / 1000) // Convert deltaTime from ms to seconds
    };
  }

  isOffScreen(position: Position, canvasHeight: number): boolean {
    return position.y > canvasHeight + 50; // Add buffer for cleanup
  }

  calculateSpeed(event: HookEvent, baseSpeed: number): number {
    // Calculate speed based on event age and type
    const now = Date.now();
    const eventAge = now - (event.timestamp || now);
    
    // Recent events fall faster
    const ageFactor = eventAge < 30000 ? 1.5 : eventAge < 300000 ? 1.0 : 0.8;
    
    return baseSpeed * ageFactor;
  }

  getColumnXPosition(column: number, columnWidth: number): number {
    return column * columnWidth + columnWidth / 2; // Center of column
  }
}

// ============================================================================
// Main Event Transformer Implementation
// ============================================================================

export class MatrixEventTransformer implements EventToDropTransformer {
  private characterMapper: CharacterMapper;
  private columnManager: ColumnManager;
  private positionCalculator: PositionCalculator;
  private mappingRules: EventMappingRules;

  constructor(private config: TransformerConfig) {
    this.characterMapper = new MatrixCharacterMapper(config.characterSets);
    this.columnManager = new MatrixColumnManager(config.totalColumns);
    this.positionCalculator = new MatrixPositionCalculator();
    this.mappingRules = DEFAULT_MAPPING_RULES;
  }

  transform(event: HookEvent): MatrixDrop {
    // Extract event data
    const eventData = this.extractEventData(event);
    
    // Determine drop type
    const dropType = this.determineDropType(eventData);
    
    // Assign column
    const column = this.columnManager.assignColumn(
      eventData.sessionId,
      eventData.sourceApp,
      dropType
    );
    
    // Calculate spawn position
    const spawnPosition = this.positionCalculator.calculateSpawnPosition(column, dropType);
    
    // Generate character sequence
    const characters = this.generateCharacterSequence(eventData);
    
    // Calculate speed
    const speed = this.calculateDropSpeed(event, dropType);
    
    // Determine effects
    const effects = this.determineEffects(eventData, dropType);
    
    // Generate brightness array
    const brightness = this.generateBrightnessArray(characters.length);
    
    // Get colors
    const colors = this.getDropColors(eventData, dropType);

    return {
      id: `${event.id || 'unknown'}-${Date.now()}-${Math.random()}`,
      column,
      position: spawnPosition.y,
      speed,
      characters,
      brightness,
      headColor: colors.head,
      trailColor: colors.trail,
      sourceEvent: event,
      createdAt: Date.now(),
      type: dropType,
      effects,
      trailLength: Math.min(characters.length, this.config.defaultTrailLength),
      isActive: true
    };
  }

  transformBatch(events: HookEvent[]): MatrixDrop[] {
    return events.map(event => this.transform(event));
  }

  updateConfig(newConfig: Partial<TransformerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate components if necessary
    if (newConfig.characterSets) {
      this.characterMapper = new MatrixCharacterMapper(this.config.characterSets);
    }
    if (newConfig.totalColumns) {
      this.columnManager = new MatrixColumnManager(this.config.totalColumns);
    }
  }

  getConfig(): TransformerConfig {
    return { ...this.config };
  }

  getColumnForSession(sessionId: string, sourceApp: string): number {
    const sessionKey = `${sessionId}-${sourceApp}`;
    return this.columnManager.reserveColumnForSession(sessionKey);
  }

  getAvailableColumns(): number[] {
    const stats = this.columnManager.getColumnStats();
    const allColumns = Array.from({ length: stats.total }, (_, i) => i);
    return allColumns.filter(col => this.columnManager.isColumnAvailable(col));
  }

  releaseColumn(column: number): void {
    this.columnManager.releaseColumn(column);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private extractEventData(event: HookEvent): EventDataExtraction {
    return {
      agentName: event.payload?.agentName || event.payload?.name || 'Unknown',
      sessionId: event.session_id || 'unknown-session',
      sourceApp: event.source_app || 'unknown-app',
      eventType: event.hook_event_type || 'unknown-event',
      status: event.payload?.status,
      timestamp: event.timestamp || Date.now(),
      payload: event.payload || {}
    };
  }

  private determineDropType(eventData: EventDataExtraction): MatrixDropType {
    const eventType = eventData.eventType || '';
    if (eventType.includes('error')) return 'error';
    if (eventType.includes('complete')) return 'completion';
    if (eventType.includes('spawn') || eventType.includes('start')) return 'spawn';
    if (eventData.status) return 'status-update';
    return 'event-data';
  }

  private generateCharacterSequence(eventData: EventDataExtraction): string[] {
    const characters: string[] = [];
    
    // Add event type symbol
    characters.push(this.characterMapper.mapEventTypeToSymbol(eventData.eventType));
    
    // Add agent name (if available)
    if (eventData.agentName) {
      characters.push(...this.characterMapper.mapAgentName(eventData.agentName));
    }
    
    // Add session ID characters
    characters.push(...this.characterMapper.mapSessionId(eventData.sessionId).slice(0, 3));
    
    // Add timestamp
    characters.push(...this.characterMapper.mapTimestamp(eventData.timestamp));
    
    // Add status symbol (if available)
    if (eventData.status) {
      characters.push(this.characterMapper.mapStatusToSymbol(eventData.status));
    }
    
    // Pad with random Matrix characters to reach trail length
    const targetLength = this.config.defaultTrailLength;
    while (characters.length < targetLength) {
      characters.push(...this.characterMapper.generateRandomChars(
        Math.min(3, targetLength - characters.length)
      ));
    }
    
    return characters.slice(0, targetLength);
  }

  private calculateDropSpeed(event: HookEvent, dropType: MatrixDropType): number {
    const baseSpeed = 80; // pixels per second
    
    // Apply type-based speed multiplier
    const eventType = event.hook_event_type || 'unknown';
    const typeMultiplier = this.mappingRules.speedMap[eventType] || 1.0;
    
    // Apply drop type multiplier
    const dropTypeMultipliers: Record<MatrixDropType, number> = {
      'event-data': 1.0,
      'ambient': 0.7,
      'status-update': 1.2,
      'error': 1.5,
      'completion': 1.3,
      'spawn': 1.8
    };
    
    const dropMultiplier = dropTypeMultipliers[dropType] || 1.0;
    
    // Apply age-based speed
    const speed = this.positionCalculator.calculateSpeed(event, baseSpeed);
    
    return speed * typeMultiplier * dropMultiplier * this.config.speedMultiplier;
  }

  private determineEffects(eventData: EventDataExtraction, dropType: MatrixDropType): MatrixDropEffect[] {
    const effects: MatrixDropEffect[] = [];
    
    // Add drop type effects
    if (dropType === 'spawn') {
      effects.push(...this.config.effectPresets.spawn);
    } else if (dropType === 'error') {
      effects.push(...this.config.effectPresets.error);
    } else if (dropType === 'completion') {
      effects.push(...this.config.effectPresets.completion);
    } else if (dropType === 'status-update') {
      effects.push(...this.config.effectPresets.statusChange);
    }
    
    // Add event-specific effects
    const eventEffects = this.mappingRules.effectMap[eventData.eventType];
    if (eventEffects) {
      effects.push(...eventEffects);
    }
    
    return effects;
  }

  private generateBrightnessArray(length: number): number[] {
    const brightness: number[] = [];
    
    for (let i = 0; i < length; i++) {
      // Head character is brightest (1.0), trails fade exponentially
      const position = i / length;
      const fade = Math.max(0.1, 1.0 - Math.pow(position, 0.8));
      brightness.push(fade);
    }
    
    return brightness;
  }

  private getDropColors(eventData: EventDataExtraction, dropType: MatrixDropType): { head: string; trail: string } {
    // Check for event-specific color
    const eventColor = this.mappingRules.colorMap[eventData.eventType];
    if (eventColor) {
      return { head: eventColor, trail: this.config.colorSchemes.standard.trail };
    }
    
    // Use drop type colors
    switch (dropType) {
      case 'error':
        return { 
          head: this.config.colorSchemes.error.head, 
          trail: this.config.colorSchemes.error.trail 
        };
      case 'completion':
        return { 
          head: this.config.colorSchemes.success.head, 
          trail: this.config.colorSchemes.success.trail 
        };
      case 'spawn':
        return { 
          head: this.config.colorSchemes.spawn.head, 
          trail: this.config.colorSchemes.spawn.trail 
        };
      default:
        return { 
          head: this.config.colorSchemes.standard.head, 
          trail: this.config.colorSchemes.standard.trail 
        };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new EventToDropTransformer with default configuration
 */
export function createEventToDropTransformer(
  canvasWidth: number, 
  canvasHeight: number,
  columnWidth: number = 20
): EventToDropTransformer {
  const config: TransformerConfig = {
    canvasWidth,
    canvasHeight,
    columnWidth,
    totalColumns: Math.floor(canvasWidth / columnWidth),
    maxDrops: 1000,
    defaultTrailLength: 15,
    speedMultiplier: 1.0,
    characterSets: DEFAULT_CHARACTER_SETS,
    colorSchemes: DEFAULT_COLOR_SCHEMES,
    effectPresets: DEFAULT_EFFECT_PRESETS
  };
  
  return new MatrixEventTransformer(config);
}