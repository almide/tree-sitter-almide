; Almide syntax highlighting.
;
; Three decisions are shared with the playground editor (playground/web/editor.js)
; and the TextMate grammar (almide.tmLanguage.json). Keep them in step:
;
;   1. Module names get their own colour, distinct from function names.
;   2. `${ … }` is code, not string — the braces are punctuation and the
;      expression inside keeps its ordinary highlighting.
;   3. Only "…" and """…""" interpolate. '…' and r"…" are literal.
;
; Plain identifiers are deliberately left uncaptured: only binding sites,
; parameters and patterns are marked, so no rule has to out-rank a blanket
; `(identifier) @variable` (query precedence differs between editors).

; ---------- comments ----------

(line_comment) @comment
(block_comment) @comment

; ---------- literals ----------

(integer_literal) @number
(float_literal) @number
(boolean_literal) @boolean

(string_literal) @string
(single_quote_string) @string
(raw_string) @string
(heredoc_string) @string
(escape_sequence) @string.escape

; The expression inside is highlighted by the rules below; only the braces
; themselves belong to the string.
(string_interpolation
  "${" @punctuation.special
  "}" @punctuation.special)

; ---------- modules ----------

; `import random`, `import self.spark` — every path segment names a module.
((import_path (identifier) @module)
  (#not-eq? @module "self"))

((import_path (identifier) @keyword)
  (#eq? @keyword "self"))

(module_declaration (identifier) @module)

; Receiver position: `int.to_string(…)`, `list.map(…)`. Restricted to the
; stdlib names so record field access (`row.name`) keeps the variable colour.
((member_expression
   (expression (primary_expression (identifier) @module)))
  (#any-of? @module
    "string" "list" "map" "set" "int" "float" "math" "datetime" "error"
    "value" "bytes" "matrix" "option" "result" "prim" "fs" "env" "process"
    "io" "json" "random" "regex" "testing" "log" "path" "args" "http"
    "net" "zlib" "base64" "hex" "html" "mem"))

; ---------- types ----------

(type_name) @type

; ---------- functions ----------

(function_declaration (function_name) @function)
(predicate_identifier) @function

; `spark.at(i, step)` — the member is the one being called.
(call_expression
  (expression (member_expression (identifier) @function.call)))

; `println(x)` — a bare call target.
(call_expression
  (expression (primary_expression (identifier) @function.call)))

; ---------- bindings ----------

(parameter (identifier) @variable.parameter)
(let_statement (identifier) @variable)
(var_statement (identifier) @variable)
(identifier_pattern) @variable
(rest_pattern name: (identifier) @variable)
(as_pattern name: (identifier) @variable)

; ---------- keywords ----------

[
  "module"
  "import"
  "as"
  "type"
  "protocol"
  "fn"
  "let"
  "var"
  "test"
  "pub"
  "strict"
  "effect"
] @keyword

[
  "if"
  "then"
  "else"
  "match"
  "for"
  "in"
  "while"
  "guard"
  "break"
  "continue"
] @keyword

[
  "not"
  "and"
  "or"
] @keyword.operator

; ---------- operators and punctuation ----------

[
  "|>"
  "->"
  "=>"
  "=="
  "!="
  "<="
  ">="
  "??"
  "+"
  "-"
  "*"
  "/"
  "%"
  "<"
  ">"
  "="
  ".."
  "@"
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ":"
  "."
] @punctuation.delimiter
