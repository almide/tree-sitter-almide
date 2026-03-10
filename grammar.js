/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  PIPE: 1,
  OR: 2,
  AND: 3,
  COMPARE: 4,
  ADD: 5,
  MULTIPLY: 6,
  UNARY: 7,
  MEMBER: 8,
  CALL: 9,
};

module.exports = grammar({
  name: "almide",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    [$._type_body, $._type_expr],
    [$.expression_statement, $.block_expression],
    [$.record_expression, $.block_expression],
    [$.expression, $.range_expression],
  ],

  rules: {
    source_file: ($) =>
      seq(
        optional($.module_declaration),
        repeat($.import_declaration),
        repeat($._top_declaration)
      ),

    // ─── Module ───
    module_declaration: ($) => seq("module", $.identifier),

    // ─── Imports ───
    import_declaration: ($) =>
      seq(
        "import",
        $.import_path,
        optional(seq("as", $.identifier))
      ),

    import_path: ($) =>
      seq($.identifier, repeat(seq(".", $.identifier))),

    // ─── Top-level declarations ───
    _top_declaration: ($) =>
      choice(
        $.function_declaration,
        $.type_declaration,
        $.trait_declaration,
        $.impl_declaration,
        $.test_declaration
      ),

    // ─── Functions ───
    function_declaration: ($) =>
      seq(
        optional($.visibility_modifier),
        optional("async"),
        optional("effect"),
        "fn",
        $.function_name,
        optional($.generic_params),
        $.parameter_list,
        "->",
        $._type_expr,
        "=",
        $.expression
      ),

    visibility_modifier: ($) => choice("pub", "mod", "local"),

    function_name: ($) => choice($.identifier, $.predicate_identifier),

    predicate_identifier: ($) => /[a-z_][a-zA-Z0-9_]*\?/,

    parameter_list: ($) =>
      seq("(", optional(commaSep1($.parameter)), ")"),

    parameter: ($) =>
      seq($.identifier, ":", $._type_expr),

    // ─── Types ───
    type_declaration: ($) =>
      seq(
        "type",
        $.type_name,
        optional($.generic_params),
        "=",
        $._type_body
      ),

    _type_body: ($) =>
      seq(
        choice($.record_type, $.variant_type, $.newtype, $._type_expr),
        optional($.deriving_clause)
      ),

    record_type: ($) =>
      seq("{", optional(commaSep1($.field_type)), optional(","), "}"),

    field_type: ($) => seq($.identifier, ":", $._type_expr),

    variant_type: ($) =>
      seq("|", $.variant_case, repeat(seq("|", $.variant_case))),

    variant_case: ($) =>
      seq(
        $.type_name,
        optional(
          choice(
            seq("(", commaSep1($._type_expr), ")"),
            seq("{", commaSep1($.field_type), "}")
          )
        )
      ),

    newtype: ($) => seq("newtype", $._type_expr),

    deriving_clause: ($) =>
      seq("deriving", commaSep1($.type_name)),

    generic_params: ($) =>
      seq("[", commaSep1($.type_param), "]"),

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
        $.unit_type
      ),

    generic_type: ($) =>
      seq($.type_name, "[", commaSep1($._type_expr), "]"),

    function_type: ($) =>
      seq("fn", "(", optional(commaSep1($._type_expr)), ")", "->", $._type_expr),

    tuple_type: ($) =>
      seq("(", $._type_expr, ",", commaSep1($._type_expr), ")"),

    unit_type: ($) => seq("(", ")"),

    // ─── Traits ───
    trait_declaration: ($) =>
      seq(
        "trait",
        $.type_name,
        optional($.generic_params),
        "{",
        repeat($.trait_method),
        "}"
      ),

    trait_method: ($) =>
      seq(
        optional("effect"),
        "fn",
        $.function_name,
        optional($.generic_params),
        $.parameter_list,
        "->",
        $._type_expr
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
        "}"
      ),

    // ─── Tests ───
    test_declaration: ($) =>
      seq("test", $.string_literal, $.block_expression),

    // ─── Statements ───
    _statement: ($) =>
      choice(
        $.let_statement,
        $.var_statement,
        $.assignment_statement,
        $.expression_statement
      ),

    let_statement: ($) =>
      choice(
        seq("let", $.identifier, optional(seq(":", $._type_expr)), "=", $.expression),
        seq("let", "{", commaSep1($.identifier), "}", "=", $.expression)
      ),

    var_statement: ($) =>
      seq("var", $.identifier, optional(seq(":", $._type_expr)), "=", $.expression),

    assignment_statement: ($) =>
      seq($.identifier, "=", $.expression),

    expression_statement: ($) => $.expression,

    // ─── Expressions ───
    expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.pipe_expression,
        $.primary_expression
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
        $.record_expression,
        $.tuple_expression,
        $.call_expression,
        $.member_expression,
        $.tuple_index_expression,
        $.if_expression,
        $.match_expression,
        $.block_expression,
        $.do_expression,
        $.for_in_expression,
        $.lambda_expression,
        $.try_expression,
        $.await_expression,
        $.range_expression,
        $.some_expression,
        $.none_expression,
        $.ok_expression,
        $.err_expression,
        $.hole_expression,
        $.todo_expression,
        $.parenthesized_expression
      ),

    // ─── Literals ───
    integer_literal: ($) => /[0-9]+/,
    float_literal: ($) => /[0-9]+\.[0-9]+/,

    string_literal: ($) =>
      choice(
        seq(
          '"',
          repeat(choice($.escape_sequence, $.string_interpolation, $.string_content)),
          '"'
        ),
        $.raw_string
      ),

    string_content: ($) => /[^"\\$]+|\$/,

    raw_string: ($) => token(seq('r"', /[^"]*/, '"')),

    string_interpolation: ($) =>
      seq("${", $.expression, "}"),

    heredoc_string: ($) =>
      token(choice(
        seq('"""', /([^"]|"[^"]|""[^"])*/, '"""'),
        seq('r"""', /([^"]|"[^"]|""[^"])*/, '"""')
      )),

    escape_sequence: ($) =>
      /\\[nrt\\"$]/,

    boolean_literal: ($) => choice("true", "false"),

    unit_expression: ($) => prec(1, seq("(", ")")),

    // ─── Collections ───
    list_expression: ($) =>
      seq("[", optional(commaSep1($.expression)), optional(","), "]"),

    record_expression: ($) =>
      seq(
        "{",
        optional($.spread_field),
        optional(commaSep1($.record_field)),
        optional(","),
        "}"
      ),

    record_field: ($) =>
      seq($.identifier, ":", $.expression),

    spread_field: ($) =>
      seq("...", $.expression, ","),

    tuple_expression: ($) =>
      seq("(", $.expression, ",", commaSep1($.expression), ")"),

    // ─── Calls & Access ───
    call_expression: ($) =>
      prec.left(PREC.CALL, seq(
        choice($.identifier, $.predicate_identifier, $.type_name, $.member_expression),
        $.argument_list
      )),

    argument_list: ($) =>
      seq("(", optional(commaSep1($.argument)), ")"),

    argument: ($) =>
      choice(
        seq($.identifier, ":", $.expression),  // named argument
        $.expression
      ),

    member_expression: ($) =>
      prec.left(PREC.MEMBER, seq(
        choice($.primary_expression),
        ".",
        choice($.identifier, $.predicate_identifier)
      )),

    tuple_index_expression: ($) =>
      prec.left(PREC.MEMBER, seq($.primary_expression, ".", $.integer_literal)),

    // ─── Operators ───
    binary_expression: ($) =>
      choice(
        ...[
          ["or", PREC.OR],
          ["and", PREC.AND],
          ["==", PREC.COMPARE],
          ["!=", PREC.COMPARE],
          ["<", PREC.COMPARE],
          [">", PREC.COMPARE],
          ["<=", PREC.COMPARE],
          [">=", PREC.COMPARE],
          ["+", PREC.ADD],
          ["-", PREC.ADD],
          ["++", PREC.ADD],
          ["*", PREC.MULTIPLY],
          ["/", PREC.MULTIPLY],
          ["%", PREC.MULTIPLY],
          ["^", PREC.MULTIPLY],
        ].map(([op, prec_val]) =>
          prec.left(/** @type {number} */ (prec_val), seq(
            field("left", $.expression),
            field("operator", /** @type {string} */ (op)),
            field("right", $.expression)
          ))
        )
      ),

    unary_expression: ($) =>
      prec(PREC.UNARY, seq(
        field("operator", choice("not", "-")),
        field("operand", $.expression)
      )),

    pipe_expression: ($) =>
      prec.right(PREC.PIPE, seq(
        field("left", $.expression),
        "|>",
        field("right", $.expression)
      )),

    // ─── Control Flow ───
    if_expression: ($) =>
      seq("if", field("condition", $.expression), "then", field("consequence", $.expression), "else", field("alternative", $.expression)),

    match_expression: ($) =>
      seq("match", field("value", $.expression), "{", commaSep1($.match_arm), optional(","), "}"),

    match_arm: ($) =>
      seq(
        field("pattern", $.pattern),
        optional(seq("if", field("guard", $.expression))),
        "=>",
        field("body", $.expression)
      ),

    block_expression: ($) =>
      seq("{", repeat($._statement), optional($.expression), "}"),

    do_expression: ($) =>
      seq("do", $.block_expression),

    for_in_expression: ($) =>
      seq("for", $.identifier, "in", $.expression, $.block_expression),

    guard_expression: ($) =>
      seq("guard", $.expression, "else", $.expression),

    // ─── Lambdas ───
    lambda_expression: ($) =>
      seq("fn", "(", optional(commaSep1($.lambda_param)), ")", "=>", $.expression),

    lambda_param: ($) =>
      choice(
        seq($.identifier, ":", $._type_expr),
        $.identifier
      ),

    // ─── Result/Option constructors ───
    some_expression: ($) => seq("some", "(", $.expression, ")"),
    none_expression: ($) => "none",
    ok_expression: ($) => seq("ok", "(", $.expression, ")"),
    err_expression: ($) => seq("err", "(", $.expression, ")"),

    // ─── Special expressions ───
    try_expression: ($) => seq("try", $.expression),
    await_expression: ($) => seq("await", $.expression),
    hole_expression: ($) => "_",
    todo_expression: ($) =>
      seq("todo", "(", optional($.string_literal), ")"),

    range_expression: ($) =>
      prec.left(seq($.primary_expression, choice("..", "..="), $.primary_expression)),

    parenthesized_expression: ($) =>
      seq("(", $.expression, ")"),

    // ─── Patterns ───
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
        $.record_pattern,
        $.tuple_pattern
      ),

    wildcard_pattern: ($) => "_",
    identifier_pattern: ($) => $.identifier,

    literal_pattern: ($) =>
      choice($.integer_literal, $.float_literal, $.string_literal, $.boolean_literal),

    some_pattern: ($) => seq("some", "(", $.pattern, ")"),
    none_pattern: ($) => "none",
    ok_pattern: ($) => seq("ok", "(", $.pattern, ")"),
    err_pattern: ($) => seq("err", "(", $.pattern, ")"),

    constructor_pattern: ($) =>
      seq($.type_name, "(", optional(commaSep1($.pattern)), ")"),

    record_pattern: ($) =>
      seq("{", commaSep1($.identifier), "}"),

    tuple_pattern: ($) =>
      seq("(", $.pattern, ",", commaSep1($.pattern), ")"),

    // ─── Comments ───
    line_comment: ($) => /\/\/[^\n]*/,
    block_comment: ($) =>
      token(seq("(*", /([^*]|\*[^)])*/, "*)")),

    // ─── Identifiers ───
    identifier: ($) => /[a-z_][a-zA-Z0-9_]*/,
    type_name: ($) => /[A-Z][a-zA-Z0-9]*/,
  },
});

/**
 * Comma-separated list of one or more items.
 * @param {RuleOrLiteral} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
