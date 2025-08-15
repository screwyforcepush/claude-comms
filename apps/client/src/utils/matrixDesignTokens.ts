/**
 * Matrix Mode Design Tokens (Programmatic Access)
 * 
 * Provides TypeScript access to design tokens.
 * Used by character system and visual effects.
 */

// Design tokens embedded directly to avoid import issues during testing
const designTokens = {
  matrixMode: {
    colors: {
      background: {
        primary: "#000000",
        noise: "rgba(0, 17, 0, 0.03)"
      },
      characters: {
        head: "#FFFFFF",
        trail: {
          brightest: "#00FF00",
          bright: "#00DD00", 
          medium: "#00BB00",
          dim: "#008800",
          dimmer: "#004400",
          darkest: "#002200"
        }
      },
      status: {
        error: "#FF3030",
        warning: "#FFAA00", 
        success: "#00FFAA",
        info: "#00AAFF",
        pending: "#AAAA00"
      },
      effects: {
        spawn: {
          flash: "#FFFFFF",
          pulse: "#00FF00",
          glow: "rgba(0, 255, 0, 0.4)"
        },
        completion: {
          success: "#FFFFFF",
          trail: "#00FFAA",
          glow: "rgba(0, 255, 170, 0.3)"
        },
        error: {
          alert: "#FF3030",
          trail: "#FF6060",
          glow: "rgba(255, 48, 48, 0.3)"
        }
      }
    },
    typography: {
      characters: {
        fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
        fontSize: "14px",
        fontWeight: "400",
        lineHeight: "20px",
        letterSpacing: "0px"
      },
      characterSets: {
        katakana: ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ", "ス", "セ", "ソ", "タ", "チ", "ツ", "テ", "ト", "ナ", "ニ", "ヌ", "ネ", "ノ", "ハ", "ヒ", "フ", "ヘ", "ホ", "マ", "ミ", "ム", "メ", "モ", "ヤ", "ユ", "ヨ", "ラ", "リ", "ル", "レ", "ロ", "ワ", "ヲ", "ン"],
        symbols: {
          start: "◢",
          complete: "◆", 
          error: "⚠",
          spawn: "↕",
          in_progress: "◐",
          success: "✓",
          pending: "⧗",
          data: "◊",
          message: "◈"
        },
        numeric: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        alphanumeric: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
      }
    },
    animation: {
      speeds: {
        recent: {
          min: "100px/s",
          max: "150px/s"
        },
        medium: {
          min: "80px/s", 
          max: "120px/s"
        },
        old: {
          min: "60px/s",
          max: "100px/s"
        },
        background: {
          min: "40px/s",
          max: "80px/s"
        }
      },
      trails: {
        eventStream: {
          minLength: 8,
          maxLength: 15
        },
        backgroundStream: {
          minLength: 6,
          maxLength: 20
        },
        statusStream: {
          minLength: 3,
          maxLength: 8
        }
      },
      effects: {
        spawn: {
          duration: "800ms",
          pulseCount: 3,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)"
        },
        completion: {
          pauseDuration: "500ms",
          fadeOutDuration: "1000ms",
          glowDuration: "2000ms"
        },
        error: {
          speedMultiplier: 1.5,
          glowDuration: "3000ms",
          pulseFrequency: "2Hz"
        }
      }
    },
    opacity: {
      characters: {
        head: 1.0,
        trail1: 0.9,
        trail2: 0.8,
        trail3: 0.6,
        trail4: 0.4,
        trail5: 0.2,
        tail: 0.05
      }
    }
  }
};

export const matrixModeTokens = designTokens.matrixMode;

// Type-safe access to specific token groups
export const colors = matrixModeTokens.colors;
export const typography = matrixModeTokens.typography;
export const spacing = matrixModeTokens.spacing;
export const animation = matrixModeTokens.animation;
export const opacity = matrixModeTokens.opacity;
export const layers = matrixModeTokens.layers;
export const responsive = matrixModeTokens.responsive;
export const accessibility = matrixModeTokens.accessibility;

// Character sets from design tokens
export const characterSets = typography.characterSets;

// Convenience exports for commonly used values
export const matrixColors = {
  background: colors.background.primary,
  trail: colors.characters.trail,
  head: colors.characters.head,
  status: colors.status,
  effects: colors.effects
};

export const matrixSpeeds = animation.speeds;
export const matrixTrails = animation.trails;
export const matrixEffects = animation.effects;

export default matrixModeTokens;