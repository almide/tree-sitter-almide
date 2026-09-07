use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_almide() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for the Almide grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_almide) };

/// The syntax highlighting query for this grammar.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

/// The symbol-tagging query for this grammar.
///
/// This is what a repository map or a ctags-style index is built from:
/// `@definition.*` captures spanning whole declarations, `@name` inside
/// each one, and `@reference.call` / `@reference.module` for the edges.
pub const TAGS_QUERY: &str = include_str!("../../queries/tags.scm");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&LANGUAGE.into())
            .expect("Error loading Almide parser");
    }

    #[test]
    fn test_parse_hello_world() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&LANGUAGE.into())
            .expect("Error loading Almide parser");

        let source = r#"
effect fn main(args: List[String]) -> Result[Unit, IoError] = {
  println("Hello, world!")
  ok(())
}
"#;
        let tree = parser.parse(source, None).unwrap();
        assert!(!tree.root_node().has_error());
    }

    // A query that names a node type the grammar does not have still ships
    // fine and fails at the consumer, at runtime, with a message about a
    // file they do not own. Compiling both here turns that into a build
    // failure in the repo that caused it.
    #[test]
    fn queries_compile_against_the_grammar() {
        for (name, source) in [
            ("highlights.scm", HIGHLIGHTS_QUERY),
            ("tags.scm", TAGS_QUERY),
        ] {
            tree_sitter::Query::new(&LANGUAGE.into(), source)
                .unwrap_or_else(|e| panic!("{name} does not compile: {e}"));
        }
    }

    #[test]
    fn tags_query_has_the_captures_an_index_reads() {
        let query = tree_sitter::Query::new(&LANGUAGE.into(), TAGS_QUERY).unwrap();
        let names = query.capture_names();
        for expected in [
            "name",
            "definition.function",
            "definition.type",
            "definition.interface",
            "definition.method",
            "definition.constant",
            "definition.test",
            "reference.call",
            "reference.module",
        ] {
            assert!(
                names.contains(&expected),
                "tags.scm no longer captures @{expected}; \
                 consumers key their index off these names"
            );
        }
    }
}
