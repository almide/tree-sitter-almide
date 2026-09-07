; Almide tags — the symbol index tools build repository maps from.
;
; Consumers: aider's repo map, ctags-style indexers, and any agent that
; needs "what is defined here, and what calls what" without parsing
; Almide itself. The capture names are the tree-sitter tags convention
; (`@definition.<kind>` / `@reference.<kind>`, with `@name` inside), the
; same shape tree-sitter-go and tree-sitter-rust use, so a tool that
; already reads their tags reads these unchanged.
;
; Every `@definition.*` spans the WHOLE declaration, not just its name —
; that is the range a reader jumps to, and the range a summariser folds.
; `@name` inside it is the identifier the index is keyed by.
;
; A definition is anything a reader would look up by name. A reference is
; a call site — the edges a map needs to rank one definition above
; another. Local `let`/`var` inside a body are deliberately absent: they
; are not addressable from another file, and indexing them buries the
; declarations that are.

; ── Definitions ──

; fn f(...) -> T = ...   and   effect fn f(...) -> T = ...
(function_declaration
  (function_name (identifier) @name)) @definition.function

; Predicate spellings (`is_empty?`-style names) parse as their own node.
(function_declaration
  (function_name (predicate_identifier) @name)) @definition.function

; type Color = Red | Blue   /   type Point = { x: Int, y: Int }
(type_declaration
  (type_name) @name) @definition.type

; protocol Show { ... }
(protocol_declaration
  (type_name) @name) @definition.interface

; The methods a protocol requires are part of its surface, so they are
; looked up by name as often as the protocol itself.
(protocol_method
  (function_name (identifier) @name)) @definition.method

; let MAX: Int = 10 at top level. The anchor pins the FIRST type_name:
; `let MAX: Int` parses as two type_name children (the binding, then its
; annotation), and without the anchor the annotation matches too.
(top_let_declaration
  . (type_name) @name) @definition.constant

; test "name" { ... } — the executable specification, and the thing a
; reader greps for when asking what behaviour is pinned.
(test_declaration
  (string_literal (string_content) @name)) @definition.test

; ── References ──

; int.to_string(n) — the member is the callee; the receiver (`int`) is the
; module and is captured separately below.
(call_expression
  (expression
    (member_expression (identifier) @name)) @reference.call)

; g(n) — a call by bare name.
(call_expression
  (expression
    (primary_expression (identifier) @name)) @reference.call)

; The module half of `int.to_string`, so a map can see which modules a
; file leans on even when no single function dominates.
(member_expression
  (expression (primary_expression (identifier) @name))) @reference.module

; import fs   /   import mod.{ A, b }
(import_declaration
  (import_path) @name) @reference.module
