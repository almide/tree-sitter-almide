# tree-sitter-almide

[Tree-sitter](https://tree-sitter.github.io/) grammar for the [Almide](https://github.com/almide) programming language.

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

## Example

```almide
module main

import std.io

effect fn main(args: List[String]) -> Result[Unit, IoError] = {
  let name = "world"
  println("Hello, ${name}!")
  ok(())
}
```

## Development

```bash
# Generate parser from grammar
npx tree-sitter generate

# Run Rust tests
cargo test

# Parse a file
npx tree-sitter parse example.almd
```

## License

MIT
