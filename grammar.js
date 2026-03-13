/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "almide",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    [$._type_body, $._type_expr],
    [$.expression_statement, $.block_expression],
    [$.record_expression, $.block_expression],
    [$._type_expr, $.primary_expression],
    [$.record_type, $.record_expression, $.block_expression],
    [$.record_type, $.record_expression],
    [$._guard_else_body, $.ok_expression],
    [$._guard_else_body, $.err_expression],
    [$.generic_type, $.primary_expression],
    [$.expression, $._range_operand],
  ],

  rules: {
    source_file: ($) =>
      seq(
        optional($.module_declaration),
        repeat($.import_declaration),
        repeat($._top_declaration),
      ),

    module_declaration: ($) => seq("module", $.identifier),

    import_declaration: ($) =>
      seq("import", $.import_path, optional(seq("as", $.identifier))),

    import_path: ($) => seq($.identifier, repeat(seq(".", $.identifier))),

    _top_declaration: ($) =>
      choice(
        $.function_declaration,
        $.type_declaration,
        $.trait_declaration,
        $.impl_declaration,
        $.test_declaration,
        $.top_let_declaration,
      ),

    // Top-level let binding (constants) — name can be lowercase or UPPERCASE
    top_let_declaration: ($) =>
      seq(
        "let",
        choice($.identifier, $.type_name),
        optional(seq(":", $._type_expr)),
        "=",
        $.expression,
      ),

    // @extern decorator
    extern_attribute: ($) =>
      seq(
        "@extern",
        "(",
        $.identifier,
        ",",
        $.string_literal,
        ",",
        $.string_literal,
        ")",
      ),

    function_declaration: ($) =>
      seq(
        repeat($.extern_attribute),
        optional($.visibility_modifier),
        optional("async"),
        optional("effect"),
        "fn",
        $.function_name,
        optional($.generic_params),
        $.parameter_list,
        "->",
        $._type_expr,
        optional(seq("=", $.expression)),
      ),

    visibility_modifier: ($) => choice("pub", "mod", "local"),

    function_name: ($) => choice($.identifier, $.predicate_identifier),

    predicate_identifier: ($) => /[a-z_][a-zA-Z0-9_]*\?/,

    parameter_list: ($) =>
      seq(
        "(",
        optional(seq($.parameter, repeat(seq(",", $.parameter)))),
        ")",
      ),

    parameter: ($) => seq($.identifier, ":", $._type_expr),

    type_declaration: ($) =>
      seq(
        "type",
        $.type_name,
        optional($.generic_params),
        "=",
        $._type_body,
      ),

    _type_body: ($) =>
      seq(
        choice($.record_type, $.variant_type, $.newtype, $._type_expr),
        optional($.deriving_clause),
      ),

    record_type: ($) =>
      seq(
        "{",
        optional(seq($.field_def, repeat(seq(",", $.field_def)))),
        optional(","),
        "}",
      ),

    // Field definition in type declarations — supports default values
    field_def: ($) =>
      seq(
        $.identifier,
        ":",
        $._type_expr,
        optional(seq("=", $._field_default_value)),
      ),

    // Default values allowed in field definitions
    _field_default_value: ($) =>
      choice(
        $.integer_literal,
        $.float_literal,
        $.string_literal,
        $.boolean_literal,
        seq("(", ")"),
        seq("[", "]"),
      ),

    variant_type: ($) =>
      seq("|", $.variant_case, repeat(seq("|", $.variant_case))),

    variant_case: ($) =>
      seq(
        $.type_name,
        optional(
          choice(
            seq(
              "(",
              seq($._type_expr, repeat(seq(",", $._type_expr))),
              ")",
            ),
            seq(
              "{",
              seq($.field_def, repeat(seq(",", $.field_def))),
              optional(","),
              "}",
            ),
          ),
        ),
      ),

    newtype: ($) => seq("newtype", $._type_expr),

    deriving_clause: ($) =>
      seq("deriving", seq($.type_name, repeat(seq(",", $.type_name)))),

    generic_params: ($) =>
      seq(
        "[",
        seq($.type_param, repeat(seq(",", $.type_param))),
        "]",
      ),

    type_param: ($) =>
      seq($.type_name, optional(seq(":", $.trait_bound))),

    trait_bound: ($) =>
      seq($.type_name, repeat(seq("+", $.type_name))),

    _type_expr: ($) =>
      choice(
        $.type_name,
        $.generic_type,
        $.function_type,
        $.record_type,
        $.tuple_type,
        $.unit_type,
      ),

    generic_type: ($) =>
      seq(
        $.type_name,
        "[",
        seq($._type_expr, repeat(seq(",", $._type_expr))),
        "]",
      ),

    function_type: ($) =>
      seq(
        "fn",
        "(",
        optional(seq($._type_expr, repeat(seq(",", $._type_expr)))),
        ")",
        "->",
        $._type_expr,
      ),

    tuple_type: ($) =>
      seq(
        "(",
        $._type_expr,
        ",",
        seq($._type_expr, repeat(seq(",", $._type_expr))),
        ")",
      ),

    unit_type: ($) => seq("(", ")"),

    trait_declaration: ($) =>
      seq(
        "trait",
        $.type_name,
        optional($.generic_params),
        "{",
        repeat($.trait_method),
        "}",
      ),

    trait_method: ($) =>
      seq(
        optional("effect"),
        "fn",
        $.function_name,
        optional($.generic_params),
        $.parameter_list,
        "->",
        $._type_expr,
      ),

    impl_declaration: ($) =>
      seq(
        "impl",
        $.type_name,
        optional($.generic_params),
        "for",
        $._type_expr,
        "{",
        repeat($.function_declaration),
        "}",
      ),

    test_declaration: ($) =>
      seq("test", $.string_literal, $.block_expression),

    _statement: ($) =>
      choice(
        $.let_statement,
        $.var_statement,
        $.guard_statement,
        $.assignment_statement,
        $.expression_statement,
      ),

    let_statement: ($) =>
      choice(
        // let x = expr  or  let _ = expr
        seq(
          "let",
          choice($.identifier, "_"),
          optional(seq(":", $._type_expr)),
          "=",
          $.expression,
        ),
        // let { a, b } = expr (record destructure)
        seq(
          "let",
          "{",
          seq($.identifier, repeat(seq(",", $.identifier))),
          "}",
          "=",
          $.expression,
        ),
        // let (a, b) = expr (tuple destructure)
        seq(
          "let",
          "(",
          seq(
            choice($.identifier, "_"),
            repeat(seq(",", choice($.identifier, "_"))),
          ),
          ")",
          "=",
          $.expression,
        ),
      ),

    var_statement: ($) =>
      seq(
        "var",
        $.identifier,
        optional(seq(":", $._type_expr)),
        "=",
        $.expression,
      ),

    // guard cond else body
    guard_statement: ($) =>
      seq("guard", $.expression, "else", $._guard_else_body),

    _guard_else_body: ($) =>
      choice(
        "break",
        "continue",
        seq("ok", "(", $.expression, ")"),
        seq("err", "(", $.expression, ")"),
        $.expression,
      ),

    // Assignment: left side can be identifier, member access, or index access
    // We use prec.right(-1) so expression_statement is preferred when no "=" follows
    assignment_statement: ($) =>
      prec.right(-1, seq(
        field("target", $.expression),
        "=",
        field("value", $.expression),
      )),

    expression_statement: ($) => $.expression,

    // Expression: left-recursive postfix ops, binary/unary/pipe, match, variant_record, range, primary
    expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.pipe_expression,
        $.call_expression,
        $.member_expression,
        $.tuple_index_expression,
        $.index_expression,
        $.match_expression,
        $.variant_record_expression,
        $.range_expression,
        $.primary_expression,
      ),

    primary_expression: ($) =>
      choice(
        $.integer_literal,
        $.float_literal,
        $.string_literal,
        $.heredoc_string,
        $.boolean_literal,
        $.unit_expression,
        $.identifier,
        $.predicate_identifier,
        $.type_name,
        $.list_expression,
        $.map_expression,
        $.record_expression,
        $.tuple_expression,
        $.if_expression,
        $.block_expression,
        $.do_expression,
        $.for_in_expression,
        $.lambda_expression,
        $.try_expression,
        $.await_expression,
        $.some_expression,
        $.none_expression,
        $.ok_expression,
        $.err_expression,
        $.hole_expression,
        $.todo_expression,
        $.parenthesized_expression,
      ),

    integer_literal: ($) =>
      token(choice(/[0-9]+/, /0x[0-9a-fA-F]+/, /0b[01]+/, /0o[0-7]+/)),

    float_literal: ($) => /[0-9]+\.[0-9]+/,

    string_literal: ($) =>
      choice(
        seq(
          "\"",
          repeat(
            choice($.escape_sequence, $.string_interpolation, $.string_content),
          ),
          "\"",
        ),
        $.raw_string,
      ),

    string_content: ($) => /[^"\\$]+|\$/,

    raw_string: ($) => token(seq("r\"", /[^"]*/, "\"")),

    string_interpolation: ($) => seq("${", $.expression, "}"),

    heredoc_string: ($) =>
      token(
        choice(
          seq("\"\"\"", /([^"]|"[^"]|""[^"])*/, "\"\"\""),
          seq("r\"\"\"", /([^"]|"[^"]|""[^"])*/, "\"\"\""),
        ),
      ),

    escape_sequence: ($) => /\\[nrt\\"$]/,

    boolean_literal: ($) => choice("true", "false"),

    unit_expression: ($) => prec(1, seq("(", ")")),

    list_expression: ($) =>
      seq(
        "[",
        optional(seq($.expression, repeat(seq(",", $.expression)))),
        optional(","),
        "]",
      ),

    map_expression: ($) =>
      choice(
        seq("[", ":", "]"),
        seq(
          "[",
          seq($.map_entry, repeat(seq(",", $.map_entry))),
          optional(","),
          "]",
        ),
      ),

    map_entry: ($) =>
      seq(field("key", $.expression), ":", field("value", $.expression)),

    record_expression: ($) =>
      seq(
        "{",
        optional($.spread_field),
        optional(seq($.record_field, repeat(seq(",", $.record_field)))),
        optional(","),
        "}",
      ),

    record_field: ($) => seq($.identifier, ":", $.expression),

    spread_field: ($) => seq("...", $.expression, ","),

    tuple_expression: ($) =>
      seq(
        "(",
        $.expression,
        ",",
        seq($.expression, repeat(seq(",", $.expression))),
        ")",
      ),

    // TypeName { field: value, ... } — variant record constructor
    // NOT left-recursive; starts with type_name token directly
    variant_record_expression: ($) =>
      prec.dynamic(-10, prec(9, seq(
        $.type_name,
        "{",
        optional(seq($.record_field, repeat(seq(",", $.record_field)))),
        optional(","),
        "}",
      ))),

    // match expression: starts with "match" keyword, then expression, then "{" arms "}"
    // The match value uses a restricted expression set to avoid TypeName { } ambiguity
    // with variant_record_expression. The key: match_expression starts with "match" keyword
    // which prevents variant_record_expression from stealing the "{" since variant_record_expression
    // is NOT reachable as a prefix of match value (it starts with type_name, not "match").
    //
    // HOWEVER: we must ensure that the expression parsed as match value does NOT itself
    // expand into variant_record_expression. We achieve this by NOT including
    // variant_record_expression in _match_value. Since postfix ops (call, member, index)
    // use $.expression which DOES include variant_record_expression, we define separate
    // _match_* versions of the postfix ops that use _match_value instead.
    match_expression: ($) =>
      seq(
        "match",
        field("value", $._match_value),
        "{",
        repeat1(seq($.match_arm, optional(","))),
        "}",
      ),

    // A restricted expression for match values — everything EXCEPT variant_record_expression
    _match_value: ($) =>
      choice(
        $._match_binary,
        $._match_unary,
        $._match_pipe,
        $._match_call,
        $._match_member,
        $._match_tuple_index,
        $._match_index,
        $._match_range,
        $.primary_expression,
      ),

    // Match-safe postfix and compound expressions that don't allow variant_record_expression
    _match_binary: ($) =>
      choice(
        prec.left(2, seq(field("left", $._match_value), field("operator", "or"), field("right", $._match_value))),
        prec.left(3, seq(field("left", $._match_value), field("operator", "and"), field("right", $._match_value))),
        prec.left(4, seq(field("left", $._match_value), field("operator", "=="), field("right", $._match_value))),
        prec.left(4, seq(field("left", $._match_value), field("operator", "!="), field("right", $._match_value))),
        prec.left(4, seq(field("left", $._match_value), field("operator", "<"), field("right", $._match_value))),
        prec.left(4, seq(field("left", $._match_value), field("operator", ">"), field("right", $._match_value))),
        prec.left(4, seq(field("left", $._match_value), field("operator", "<="), field("right", $._match_value))),
        prec.left(4, seq(field("left", $._match_value), field("operator", ">="), field("right", $._match_value))),
        prec.left(5, seq(field("left", $._match_value), field("operator", "+"), field("right", $._match_value))),
        prec.left(5, seq(field("left", $._match_value), field("operator", "-"), field("right", $._match_value))),
        prec.left(5, seq(field("left", $._match_value), field("operator", "++"), field("right", $._match_value))),
        prec.left(6, seq(field("left", $._match_value), field("operator", "*"), field("right", $._match_value))),
        prec.left(6, seq(field("left", $._match_value), field("operator", "/"), field("right", $._match_value))),
        prec.left(6, seq(field("left", $._match_value), field("operator", "%"), field("right", $._match_value))),
        prec.left(6, seq(field("left", $._match_value), field("operator", "^"), field("right", $._match_value))),
      ),

    _match_unary: ($) =>
      prec(7, seq(field("operator", choice("not", "-")), field("operand", $._match_value))),

    _match_pipe: ($) =>
      prec.right(1, seq(field("left", $._match_value), "|>", field("right", $._match_value))),

    _match_call: ($) =>
      prec.left(9, seq($._match_value, optional($.turbofish), $.argument_list)),

    _match_member: ($) =>
      prec.left(8, seq($._match_value, ".", choice($.identifier, $.predicate_identifier))),

    _match_tuple_index: ($) =>
      prec.left(8, seq($._match_value, ".", $.integer_literal)),

    _match_index: ($) =>
      prec.left(8, seq($._match_value, "[", $.expression, "]")),

    _match_range: ($) =>
      prec.left(0, seq($._match_value, choice("..", "..="), $._match_value)),

    match_arm: ($) =>
      seq(
        field("pattern", $.pattern),
        optional(seq("if", field("guard", $.expression))),
        "=>",
        field("body", $.expression),
      ),

    block_expression: ($) =>
      seq(
        "{",
        repeat(seq($._statement, optional(";"))),
        optional($.expression),
        "}",
      ),

    do_expression: ($) => seq("do", $.block_expression),

    for_in_expression: ($) =>
      seq(
        "for",
        choice(
          $.identifier,
          seq("(", $.identifier, ",", $.identifier, ")"),
        ),
        "in",
        $.expression,
        $.block_expression,
      ),

    lambda_expression: ($) =>
      prec.right(1, seq(
        "fn",
        "(",
        optional(
          seq($.lambda_param, repeat(seq(",", $.lambda_param))),
        ),
        ")",
        "=>",
        $.expression,
      )),

    lambda_param: ($) =>
      choice(seq($.identifier, ":", $._type_expr), $.identifier),

    // call_expression: left-recursive via $.expression
    call_expression: ($) =>
      prec.left(
        9,
        seq(
          $.expression,
          optional($.turbofish),
          $.argument_list,
        ),
      ),

    turbofish: ($) =>
      seq("[", seq($._type_expr, repeat(seq(",", $._type_expr))), "]"),

    argument_list: ($) =>
      seq(
        "(",
        optional(seq($.argument, repeat(seq(",", $.argument)))),
        ")",
      ),

    argument: ($) =>
      choice(seq($.identifier, ":", $.expression), $.expression),

    // member_expression: left-recursive via $.expression
    member_expression: ($) =>
      prec.left(
        8,
        seq(
          $.expression,
          ".",
          choice($.identifier, $.predicate_identifier),
        ),
      ),

    // tuple_index_expression: left-recursive via $.expression
    tuple_index_expression: ($) =>
      prec.left(8, seq($.expression, ".", $.integer_literal)),

    // index_expression: left-recursive via $.expression
    index_expression: ($) =>
      prec.left(
        8,
        seq($.expression, "[", $.expression, "]"),
      ),

    binary_expression: ($) =>
      choice(
        prec.left(2, seq(field("left", $.expression), field("operator", "or"), field("right", $.expression))),
        prec.left(3, seq(field("left", $.expression), field("operator", "and"), field("right", $.expression))),
        prec.left(4, seq(field("left", $.expression), field("operator", "=="), field("right", $.expression))),
        prec.left(4, seq(field("left", $.expression), field("operator", "!="), field("right", $.expression))),
        prec.left(4, seq(field("left", $.expression), field("operator", "<"), field("right", $.expression))),
        prec.left(4, seq(field("left", $.expression), field("operator", ">"), field("right", $.expression))),
        prec.left(4, seq(field("left", $.expression), field("operator", "<="), field("right", $.expression))),
        prec.left(4, seq(field("left", $.expression), field("operator", ">="), field("right", $.expression))),
        prec.left(5, seq(field("left", $.expression), field("operator", "+"), field("right", $.expression))),
        prec.left(5, seq(field("left", $.expression), field("operator", "-"), field("right", $.expression))),
        prec.left(5, seq(field("left", $.expression), field("operator", "++"), field("right", $.expression))),
        prec.left(6, seq(field("left", $.expression), field("operator", "*"), field("right", $.expression))),
        prec.left(6, seq(field("left", $.expression), field("operator", "/"), field("right", $.expression))),
        prec.left(6, seq(field("left", $.expression), field("operator", "%"), field("right", $.expression))),
        prec.left(6, seq(field("left", $.expression), field("operator", "^"), field("right", $.expression))),
      ),

    unary_expression: ($) =>
      prec(
        7,
        seq(
          field("operator", choice("not", "-")),
          field("operand", $.expression),
        ),
      ),

    pipe_expression: ($) =>
      prec.right(
        1,
        seq(
          field("left", $.expression),
          "|>",
          field("right", $.expression),
        ),
      ),

    if_expression: ($) =>
      seq(
        "if",
        field("condition", $.expression),
        "then",
        field("consequence", $.expression),
        "else",
        field("alternative", $.expression),
      ),

    some_expression: ($) => seq("some", "(", $.expression, ")"),

    none_expression: ($) => "none",

    ok_expression: ($) => seq("ok", "(", $.expression, ")"),

    err_expression: ($) => seq("err", "(", $.expression, ")"),

    try_expression: ($) => prec(7, seq("try", $.expression)),

    await_expression: ($) => prec(7, seq("await", $.expression)),

    hole_expression: ($) => "_",

    todo_expression: ($) =>
      seq("todo", "(", optional($.string_literal), ")"),

    range_expression: ($) =>
      prec.left(
        0,
        seq($._range_operand, choice("..", "..="), $._range_operand),
      ),

    // Range operands: expressions that can appear in range without ambiguity
    _range_operand: ($) =>
      choice(
        $.primary_expression,
        $.call_expression,
        $.member_expression,
        $.tuple_index_expression,
        $.index_expression,
        $.unary_expression,
        $.binary_expression,
        $.match_expression,
      ),

    parenthesized_expression: ($) => seq("(", $.expression, ")"),

    // ── Patterns ──

    pattern: ($) =>
      choice(
        $.wildcard_pattern,
        $.literal_pattern,
        $.identifier_pattern,
        $.some_pattern,
        $.none_pattern,
        $.ok_pattern,
        $.err_pattern,
        $.constructor_pattern,
        $.type_name_pattern,
        $.record_pattern,
        $.variant_record_pattern,
        $.tuple_pattern,
      ),

    wildcard_pattern: ($) => "_",

    identifier_pattern: ($) => $.identifier,

    type_name_pattern: ($) => $.type_name,

    literal_pattern: ($) =>
      choice(
        $.integer_literal,
        $.float_literal,
        $.string_literal,
        $.boolean_literal,
      ),

    some_pattern: ($) => seq("some", "(", $.pattern, ")"),

    none_pattern: ($) => "none",

    ok_pattern: ($) => seq("ok", "(", $.pattern, ")"),

    err_pattern: ($) => seq("err", "(", $.pattern, ")"),

    constructor_pattern: ($) =>
      seq(
        $.type_name,
        "(",
        optional(seq($.pattern, repeat(seq(",", $.pattern)))),
        ")",
      ),

    // Match { scope, regex } or Match { scope, .. } or Match { .. }
    variant_record_pattern: ($) =>
      seq(
        $.type_name,
        "{",
        choice(
          seq(
            seq($.identifier, repeat(seq(",", $.identifier))),
            optional(seq(",", "..")),
          ),
          "..",
        ),
        optional(","),
        "}",
      ),

    record_pattern: ($) =>
      seq(
        "{",
        seq($.identifier, repeat(seq(",", $.identifier))),
        optional(seq(",", "..")),
        optional(","),
        "}",
      ),

    tuple_pattern: ($) =>
      seq(
        "(",
        $.pattern,
        ",",
        seq($.pattern, repeat(seq(",", $.pattern))),
        ")",
      ),

    // ── Terminals ──

    line_comment: ($) => /\/\/[^\n]*/,

    block_comment: ($) => token(seq("(*", /([^*]|\*[^)])*/, "*)")),

    identifier: ($) => /[a-z_][a-zA-Z0-9_]*/,

    type_name: ($) => /[A-Z][a-zA-Z0-9_]*/,
  },
});
