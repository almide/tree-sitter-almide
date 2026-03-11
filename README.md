# tree-sitter-almide

[Tree-sitter](https://tree-sitter.github.io/) grammar for the [Almide](https://github.com/almide/almide) programming language.

**The grammar is written in Almide itself.** The `generator/` directory contains pure Almide code that generates `grammar.js` — no hand-written JavaScript. This demonstrates Almide's mission: AI can produce an entire language ecosystem in Almide.

## How it works

```
generator/*.almd  →  almide build  →  gen-grammar binary
gen-grammar       →  execute       →  grammar.js
grammar.js        →  tree-sitter generate  →  src/parser.c
```

The grammar rules are modeled as an algebraic data type:

```almide
type Rule =
  | Seq(List[Rule])
  | Choice(List[Rule])
  | Repeat(Rule)
  | Str(String)
  | Ref(String)
  | Field(String, Rule)
  | PrecLeft(Int, Rule)
  | ...

fn emit(rule: Rule) -> String = match rule {
  Seq(rules) => "seq(" ++ string.join(list.map(rules, emit), ", ") ++ ")"
  Ref(name) => "$." ++ name
  ...
}
```

Each grammar rule is a function returning `(String, Rule)`:

```almide
fn if_expression() -> (String, Rule) =
  ("if_expression", Seq([
    Str("if"),
    Field("condition", Ref("expression")),
    Str("then"),
    Field("consequence", Ref("expression")),
    Str("else"),
    Field("alternative", Ref("expression"))
  ]))
```

## Features

- Full syntax coverage: modules, imports, functions, types, traits, impls, tests
- Effect system (`effect fn`, `async`)
- Pattern matching with guards
- Pipe operator (`|>`)
- Generic types with `[]` syntax
- String interpolation (`"Hello, ${name}"`)
- Heredoc strings (`"""..."""`)
- Result/Option constructors (`ok`, `err`, `some`, `none`)

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

### Regenerate grammar from Almide source

```bash
# Build the generator (requires almide compiler)
cd generator
almide build main.almd -o gen-grammar

# Generate grammar.js
./gen-grammar > ../grammar.js

# Generate parser
cd ..
tree-sitter generate

# Test
tree-sitter parse example.almd
```

### Quick rebuild (without Almide)

```bash
tree-sitter generate
cargo test
```

## License

MIT
