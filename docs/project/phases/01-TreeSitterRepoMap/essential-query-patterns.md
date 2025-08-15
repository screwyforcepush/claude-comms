# Essential Tree-Sitter Query Patterns for Implementation

## Quick Reference Implementation Guide

This document provides the essential `.scm` query patterns extracted from the reference implementation, organized for immediate use in the tree-sitter repo mapping system.

## Python Patterns (MVP Priority)

### Core Python Queries (`python-tags.scm`)

```scheme
; Class definitions
(class_definition
  name: (identifier) @name.definition.class) @definition.class

; Function definitions
(function_definition
  name: (identifier) @name.definition.function) @definition.function

; Function calls and references
(call
  function: [
    (identifier) @name.reference.call
    (attribute
      attribute: (identifier) @name.reference.call)
  ]) @reference.call
```

**Usage:**
- Extract all class definitions with names
- Extract all function definitions with names  
- Extract function calls including method calls on objects (`obj.method()`)

**Implementation Notes:**
- Simple patterns, easy to process
- Covers 90% of Python symbol extraction needs
- No documentation extraction in reference implementation

## JavaScript Patterns (Secondary Priority)

### Enhanced JavaScript Queries (`javascript-tags.scm`)

**Core Function Patterns:**
```scheme
; Multiple function definition types
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

(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.function
    value: [(arrow_function) (function)]) @definition.function)

; Assignment expressions
(assignment_expression
  left: [
    (identifier) @name.definition.function
    (member_expression
      property: (property_identifier) @name.definition.function)
  ]
  right: [(arrow_function) (function)]
) @definition.function

; Object method properties
(pair
  key: (property_identifier) @name.definition.function
  value: [(arrow_function) (function)]) @definition.function
```

**Class and Method Patterns:**
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
```

**Reference Patterns:**
```scheme
; Function calls (excluding require)
(
  (call_expression
    function: (identifier) @name.reference.call) @reference.call
  (#not-match? @name.reference.call "^(require)$")
)

; Method calls
(call_expression
  function: (member_expression
    property: (property_identifier) @name.reference.call)
  arguments: (_) @reference.call)

; Class instantiation
(new_expression
  constructor: (_) @name.reference.class) @reference.class
```

**Key Features:**
- Documentation extraction with predicates
- Multiple function definition patterns
- Method vs function distinction
- Constructor filtering

## TypeScript Patterns (Future Enhancement)

### TypeScript-Specific Queries (`typescript-tags.scm`)

```scheme
; Interface definitions
(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

; Type alias definitions
(type_alias_declaration
  name: (type_identifier) @name.definition.type) @definition.type

; Enum definitions
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Module definitions
(module
  name: (identifier) @name.definition.module) @definition.module

; Abstract classes
(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Function signatures (in interfaces)
(function_signature
  name: (identifier) @name.definition.function) @definition.function

; Method signatures
(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

; Abstract method signatures
(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

; Type references
(type_annotation
  (type_identifier) @name.reference.type) @reference.type

; Class instantiation
(new_expression
  constructor: (identifier) @name.reference.class) @reference.class
```

**TypeScript Features:**
- Type system integration
- Interface and type alias support
- Abstract class/method patterns
- Module and enum definitions

## Query Pattern Structure Reference

### Capture Naming Convention

**Definitions (what gets defined):**
- `@name.definition.class` - Class names
- `@name.definition.function` - Function names
- `@name.definition.method` - Method names
- `@name.definition.interface` - Interface names (TS)
- `@name.definition.type` - Type alias names (TS)
- `@name.definition.enum` - Enum names (TS)
- `@name.definition.module` - Module names (TS)

**References (what gets used):**
- `@name.reference.call` - Function/method calls
- `@name.reference.class` - Class usage/instantiation
- `@name.reference.type` - Type references (TS)

**Documentation:**
- `@doc` - Associated comments/documentation

### Essential Predicates

**JavaScript/TypeScript only:**
- `#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$"` - Clean comment formatting
- `#select-adjacent! @doc @definition` - Associate comments with definitions
- `#not-eq? @name "constructor"` - Exclude constructor methods
- `#not-match? @name "^(require)$"` - Exclude require calls

## Implementation Strategy

### Phase 1: Python MVP
```python
# Essential Python patterns only
PYTHON_PATTERNS = {
    "definitions": [
        "(class_definition name: (identifier) @name.definition.class) @definition.class",
        "(function_definition name: (identifier) @name.definition.function) @definition.function"
    ],
    "references": [
        "(call function: (identifier) @name.reference.call) @reference.call"
    ]
}
```

### Phase 2: JavaScript Enhancement
```python
# Core JavaScript patterns
JAVASCRIPT_PATTERNS = {
    "definitions": [
        "(function_declaration name: (identifier) @name.definition.function) @definition.function",
        "(method_definition name: (property_identifier) @name.definition.method) @definition.method",
        "(class_declaration name: (_) @name.definition.class) @definition.class"
    ],
    "references": [
        "(call_expression function: (identifier) @name.reference.call) @reference.call",
        "(new_expression constructor: (_) @name.reference.class) @reference.class"
    ]
}
```

### Phase 3: TypeScript Types
```python
# TypeScript type system patterns
TYPESCRIPT_PATTERNS = {
    "definitions": [
        "(interface_declaration name: (type_identifier) @name.definition.interface) @definition.interface",
        "(type_alias_declaration name: (type_identifier) @name.definition.type) @definition.type"
    ],
    "references": [
        "(type_annotation (type_identifier) @name.reference.type) @reference.type"
    ]
}
```

## Code Integration Examples

### Query Execution Pattern
```python
import tree_sitter

def extract_symbols(source_code: str, language: str, patterns: dict):
    parser = tree_sitter.Parser()
    parser.set_language(get_language(language))
    tree = parser.parse(source_code.encode())
    
    symbols = {}
    for pattern_type, queries in patterns.items():
        symbols[pattern_type] = []
        for query_string in queries:
            query = language.query(query_string)
            captures = query.captures(tree.root_node)
            symbols[pattern_type].extend(captures)
    
    return symbols
```

### Symbol Processing
```python
def process_captures(captures):
    symbols = {
        'definitions': {},
        'references': []
    }
    
    for node, capture_name in captures:
        if 'definition' in capture_name:
            symbol_type = capture_name.split('.')[-1]  # class, function, method
            symbol_name = node.text.decode()
            symbols['definitions'][symbol_name] = {
                'type': symbol_type,
                'line': node.start_point[0],
                'column': node.start_point[1]
            }
        elif 'reference' in capture_name:
            symbols['references'].append({
                'name': node.text.decode(),
                'line': node.start_point[0],
                'column': node.start_point[1]
            })
    
    return symbols
```

## Testing Query Patterns

### Validation Code Samples

**Python test:**
```python
class MyClass:
    def my_method(self):
        return "test"

def my_function():
    obj = MyClass()
    return obj.my_method()
```

**Expected captures:**
- `MyClass` - `@name.definition.class`
- `my_method` - `@name.definition.function`
- `my_function` - `@name.definition.function`
- `MyClass` - `@name.reference.call`
- `my_method` - `@name.reference.call`

**JavaScript test:**
```javascript
class MyClass {
    myMethod() {
        return "test";
    }
}

function myFunction() {
    const obj = new MyClass();
    return obj.myMethod();
}
```

**Expected captures:**
- `MyClass` - `@name.definition.class`
- `myMethod` - `@name.definition.method`
- `myFunction` - `@name.definition.function`
- `MyClass` - `@name.reference.class`
- `myMethod` - `@name.reference.call`

---

*Essential patterns extracted by LiamAstral - Generated with Claude Code*