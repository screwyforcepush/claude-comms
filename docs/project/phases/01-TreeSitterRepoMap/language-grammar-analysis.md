# Tree-Sitter Language Grammar Analysis

## Executive Summary

Analysis of tree-sitter query patterns for Python, JavaScript, and TypeScript reveals critical differences in node structure and naming conventions. Python uses simpler patterns while JavaScript/TypeScript employ more complex structures for method definitions and function calls. This document provides essential query patterns needed for multi-language tag extraction.

**Key Findings:**
- Python: Simple structure with `function_definition`, `class_definition`, `call`
- JavaScript: Complex patterns with `function_declaration`, `method_definition`, `call_expression`
- TypeScript: Extends JavaScript with type-specific nodes like interfaces and enums
- Comment handling and documentation extraction patterns vary significantly

## Language-Specific Query Pattern Analysis

### Python Patterns

**Strengths:**
- Minimal, clean patterns
- Straightforward definition/reference distinction
- Simple call expressions

**Critical Patterns:**
```scheme
; Class definitions
(class_definition
  name: (identifier) @name.definition.class) @definition.class

; Function definitions  
(function_definition
  name: (identifier) @name.definition.function) @definition.function

; Function calls/references
(call
  function: [
    (identifier) @name.reference.call
    (attribute
      attribute: (identifier) @name.reference.call)
  ]) @reference.call
```

**Limitations:**
- No documentation extraction patterns
- Missing method reference patterns
- No type annotation support

### JavaScript Patterns

**Strengths:**
- Comprehensive documentation extraction with comment handling
- Multiple function definition patterns (declarations, expressions, arrow functions)
- Sophisticated method and property patterns

**Critical Patterns:**
```scheme
; Method definitions with documentation
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name.definition.method) @definition.method
  (#not-eq? @name.definition.method "constructor")
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.method)
)

; Class definitions with documentation
(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name.definition.class)
    (class_declaration
      name: (_) @name.definition.class)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

; Function definitions (multiple patterns)
[
  (function
    name: (identifier) @name.definition.function)
  (function_declaration
    name: (identifier) @name.definition.function)
  (generator_function
    name: (identifier) @name.definition.function)
  (generator_function_declaration
    name: (identifier) @name.definition.function)
] @definition.function

; Arrow function assignments
(lexical_declaration
  (variable_declarator
    name: (identifier) @name.definition.function
    value: [(arrow_function) (function)]) @definition.function)

; Function calls
(call_expression
  function: (identifier) @name.reference.call) @reference.call
  (#not-match? @name.reference.call "^(require)$")

; Method calls
(call_expression
  function: (member_expression
    property: (property_identifier) @name.reference.call)
  arguments: (_) @reference.call)

; Class instantiation
(new_expression
  constructor: (_) @name.reference.class) @reference.class
```

**Advanced Features:**
- Documentation extraction with `#strip!` and `#select-adjacent!` predicates
- Filtering out specific functions like `require`
- Support for generator functions
- Multiple assignment patterns

### TypeScript Patterns

**Strengths:**
- Type system integration
- Interface and module definitions
- Abstract class/method support

**Critical Patterns:**
```scheme
; Function signatures (interfaces)
(function_signature
  name: (identifier) @name.definition.function) @definition.function

; Method signatures
(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

; Abstract methods
(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

; Abstract classes
(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Modules
(module
  name: (identifier) @name.definition.module) @definition.module

; Interfaces
(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

; Type references
(type_annotation
  (type_identifier) @name.reference.type) @reference.type

; Type aliases
(type_alias_declaration
  name: (type_identifier) @name.definition.type) @definition.type

; Enums
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum
```

**TypeScript-Specific Features:**
- Type identifier nodes (`type_identifier`)
- Interface declarations
- Type annotations and references
- Abstract class support
- Module definitions
- Enum declarations

## Essential Query Pattern Structure

### Core Pattern Components

1. **Node Selection**: `(node_type ...)`
2. **Field Matching**: `field: (type) @capture`
3. **Capture Naming**: `@name.category.subcategory`
4. **Predicates**: `(#predicate! @capture "pattern")`

### Capture Naming Convention

**Definitions:**
- `@name.definition.class`
- `@name.definition.function`
- `@name.definition.method`
- `@name.definition.interface` (TS)
- `@name.definition.type` (TS)
- `@name.definition.enum` (TS)
- `@name.definition.module` (TS)

**References:**
- `@name.reference.call`
- `@name.reference.class`
- `@name.reference.type` (TS)

**Documentation:**
- `@doc` for extracted comments

### Critical Predicates

**JavaScript/TypeScript:**
- `#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$"` - Clean comment text
- `#select-adjacent! @doc @definition` - Associate comments with definitions
- `#not-eq? @name "constructor"` - Exclude constructors
- `#not-match? @name "^(require)$"` - Exclude specific functions

## Language-Specific Tag Extraction Rules

### Python Priority Rules
1. **Function definitions** - Primary extraction target
2. **Class definitions** - Secondary priority
3. **Function calls** - References for dependency mapping
4. **Attribute access** - Method calls on objects

**Implementation Priority:** HIGH (primary use case)

### JavaScript Priority Rules
1. **Function declarations** - All variants (standard, generator, arrow)
2. **Method definitions** - Class methods with documentation
3. **Class declarations** - With comment extraction
4. **Function calls** - Excluding `require` statements
5. **New expressions** - Class instantiation

**Implementation Priority:** MEDIUM (secondary support)

### TypeScript Priority Rules
1. **Interface declarations** - Type definitions
2. **Type aliases** - Custom types
3. **Abstract classes/methods** - OOP structures
4. **Enum declarations** - Constant definitions
5. **Module declarations** - Namespace organization
6. **Type references** - Usage tracking

**Implementation Priority:** MEDIUM (future enhancement)

## Critical Patterns for Initial Implementation

### Phase 1: Core Python Support
```scheme
; Essential Python patterns - minimum viable
(class_definition name: (identifier) @name.definition.class) @definition.class
(function_definition name: (identifier) @name.definition.function) @definition.function
(call function: (identifier) @name.reference.call) @reference.call
```

### Phase 2: Enhanced JavaScript Support
```scheme
; Core JS patterns with documentation
(method_definition name: (property_identifier) @name.definition.method) @definition.method
(function_declaration name: (identifier) @name.definition.function) @definition.function
(call_expression function: (identifier) @name.reference.call) @reference.call
```

### Phase 3: TypeScript Integration
```scheme
; Type system patterns
(interface_declaration name: (type_identifier) @name.definition.interface) @definition.interface
(type_alias_declaration name: (type_identifier) @name.definition.type) @definition.type
```

## Implementation Recommendations

### Query Organization Strategy
1. **Per-language files**: Separate `.scm` files for each language
2. **Layered patterns**: Core patterns + enhanced patterns + experimental
3. **Consistent naming**: Unified capture names across languages
4. **Validation testing**: Test with canonical code samples

### Performance Considerations
1. **Pattern efficiency**: Simple patterns first, complex patterns for enhanced features
2. **Predicate optimization**: Minimize regex predicates for performance
3. **Selective extraction**: Configure which patterns to use per use case
4. **Incremental parsing**: Leverage tree-sitter's incremental capabilities

### Multi-Language Abstraction Layer
```python
# Unified symbol model
class Symbol:
    name: str
    type: str  # function, class, method, interface, etc.
    definition_node: Node
    references: List[Node]
    documentation: Optional[str]
    language: str
```

**Next Steps:**
1. Implement Python patterns for MVP
2. Create language detection and query selection logic
3. Add JavaScript patterns for broader support
4. Design TypeScript type extraction for advanced features

---

*Analysis conducted by LiamAstral - Generated with Claude Code*