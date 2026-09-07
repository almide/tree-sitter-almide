# tree-sitter-almide

[Tree-sitter](https://tree-sitter.github.io/) grammar for the [Almide](https://github.com/almide/almide) programming language.

`grammar.js` mirrors the compiler's parser (`crates/almide-syntax`), including
its real operator-precedence table:

```
or < and < comparison (non-assoc) < |> (asymmetric) < ranges
   < + - < * / % < ^ (right) < >> < unary < postfix (() [] . ! ? ?. ??)
```

`|>` is asymmetric — its right-hand side is a single call/compose chain, so
`xs |> list.map(f) + ys` parses as `(xs |> list.map(f)) + ys`, exactly like the
compiler (see `test/corpus/precedence.txt`). The executable truth upstream is
`crates/almide-syntax/src/parser/test_expr_precedence.rs`.

## Features

- Modules, imports (incl. selective `import mod.{ A, b }`), functions
  (incl. convention methods `fn Type.method`, `mut` / default parameters),
  types (records with field defaults, variants, conventions clause
  `type Name: Eq, Repr`), protocols, tests, `strict`
- Attributes: `@extern(...)`, `@intrinsic("...")`, `@name(args)`
- Effect system (`effect fn`), `guard` / `guard let`, `fan`
- Pattern matching with guards, list patterns, negative literals, record rest
- Pipe (`|>`, incl. `x |> match { ... }`), compose (`>>`), postfix
  `!` `?` `?.` `??`
- Generic types with `[]` syntax; function types `fn(A) -> B` / `(A) -> B`
- String interpolation, single-quote strings, heredocs, raw strings
- Comments: `//` and `/* ... */`

Queries in `queries/`:

- `highlights.scm` — syntax highlighting
- `tags.scm` — the symbol index repo-map tools build from
  (`@definition.function` / `.type` / `.interface` / `.method` /
  `.constant` / `.test`, and `@reference.call` / `.module`). Every
  `@definition.*` spans the whole declaration; `@name` inside it is the
  identifier the index is keyed by.

Keyword and precedence data mirrors
[almide-grammar](https://github.com/almide/almide-grammar), the descriptive
single source of truth for Almide syntax.

> **Note**: an earlier iteration generated `grammar.js` from an Almide-written
> generator (`generator/`). That generator bit-rotted against the modern
> language (it used removed syntax like `++` and `fn(x) =>` lambdas) and fell
> far behind the hand-maintained grammar, so it was removed; `grammar.js` is
> the maintained source for now. Restoring an at-parity Almide generator is
> tracked in the issues.

## File type

Almide source files use the `.almd` extension.

## Usage

### Rust

```toml
[dependencies]
tree-sitter-almide = { git = "https://github.com/almide/tree-sitter-almide" }
tree-sitter-language = "0.1"
```

```rust
use tree_sitter_almide::LANGUAGE;

let mut parser = tree_sitter::Parser::new();
parser.set_language(&LANGUAGE.into()).unwrap();
let tree = parser.parse(source, None).unwrap();
```

### Node.js

```js
const Parser = require("tree-sitter");
const Almide = require("tree-sitter-almide");

const parser = new Parser();
parser.setLanguage(Almide);
const tree = parser.parse(source);
```

## Development

```bash
tree-sitter generate   # grammar.js → src/parser.c
tree-sitter test       # run test/corpus/
```

## License

MIT
