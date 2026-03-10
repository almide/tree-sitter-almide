use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_almide() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for the Almide grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_almide) };

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
}
