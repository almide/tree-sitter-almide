/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
//
// Tree-sitter grammar for Almide, mirroring the compiler's parser
// (crates/almide-syntax). Precedence follows the compiler's Pratt table
// (parser/expressions.rs infix_bp; executable truth:
// parser/test_expr_precedence.rs):
//
//   or(1) < and(2) < comparison(3, non-assoc) < |>(4, asymmetric) < range(5)
//   < + -(6) < * / %(7) < ^(8, right) < >>(9) < unary(10) < postfix(11)
//
// `|>` is asymmetric: its right-hand side is a single postfix/compose chain
// (only `>>` nests inside it) — `xs |> f + ys` parses as `(xs |> f) + ys`.
// `x ?? fallback` takes only a unary-level fallback: `x ?? 0 + 1` is
// `(x ?? 0) + 1`.

const PREC = {
  or: 1,
  and: 2,
  compare: 3,
  pipe: 4,
  range: 5,
  add: 6,
  multiply: 7,
  power: 8,
  compose: 9,
  unary: 10,
  postfix: 11,
};

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
    [$._guard_else_body, $.break_expression],
    [$._guard_else_body, $.continue_expression],
    [$.generic_type, $.primary_expression],
    [$.expression, $._range_operand],
    [$.lambda_param, $.primary_expression],
    [$.lambda_param, $.hole_expression],
    [$.unit_expression, $.lambda_expression],
    [$.variant_case, $._type_expr],
    [$.import_path],
    [$._pipe_rhs, $._coalesce_fallback],
    [$.tuple_type],
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
      seq(
        "import",
        $.import_path,
        optional(
          choice(
            seq("as", $.identifier),
            // selective import: import mod.{ Name, helper }
            seq(
              ".",
              "{",
              seq($._import_name, repeat(seq(",", $._import_name))),
              optional(","),
              "}",
            ),
          ),
        ),
      ),

    _import_name: ($) => choice($.identifier, $.type_name),

    import_path: ($) => seq($.identifier, repeat(seq(".", $.identifier))),

    _top_declaration: ($) =>
      choice(
        $.function_declaration,
        $.type_declaration,
        $.protocol_declaration,
        $.test_declaration,
        $.top_let_declaration,
        $.strict_declaration,
      ),

    // Top-level let binding (constants) — name can be lowercase or UPPERCASE
    top_let_declaration: ($) =>
      seq(
        optional($.visibility_modifier),
        choice("let", "var"),
        choice($.identifier, $.type_name),
        optional(seq(":", $._type_expr)),
        "=",
        $.expression,
      ),

    // strict mode directive: `strict total`
    strict_declaration: ($) => seq("strict", $.identifier),

    // @name or @name(args) — @extern(...), @intrinsic("..."), @export(...),
    // @inline_rust, ...
    attribute: ($) =>
      seq(
        token(seq("@", /[a-z_][a-zA-Z0-9_]*/)),
        optional(
          seq(
            "(",
            optional(seq($._attribute_arg, repeat(seq(",", $._attribute_arg)))),
            ")",
          ),
        ),
      ),

    _attribute_arg: ($) =>
      choice(
        $.string_literal,
        $.integer_literal,
        seq("-", $.integer_literal),
        $.boolean_literal,
        $.identifier,
      ),

    function_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
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

    // fn name | fn Type.method (convention method)
    function_name: ($) =>
      choice(
        $.identifier,
        $.predicate_identifier,
        seq($.type_name, ".", choice($.identifier, $.predicate_identifier)),
      ),

    predicate_identifier: ($) => /[a-z_][a-zA-Z0-9_]*\?/,

    parameter_list: ($) =>
      seq(
        "(",
        optional(seq($.parameter, repeat(seq(",", $.parameter)))),
        optional(","),
        ")",
      ),

    // `self` is an ordinary identifier; the type annotation is optional for it.
    // Default arguments: `name: Type = expr`.
    parameter: ($) =>
      seq(
        optional("mut"),
        $.identifier,
        optional(seq(":", $._type_expr)),
        optional(seq("=", $.expression)),
      ),

    type_declaration: ($) =>
      seq(
        optional($.visibility_modifier),
        "type",
        $.type_name,
        optional($.generic_params),
        optional($.conventions_clause),
        "=",
        $._type_body,
      ),

    // `type Name: Eq, Repr = ...` — conventions/protocols the type satisfies.
    conventions_clause: ($) =>
      seq(":", $.type_name, repeat(seq(",", $.type_name))),

    _type_body: ($) =>
      choice($.record_type, $.variant_type, $._type_expr),

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

    // Leading `|` is optional: `Case1 | Case2` and `| Case1 | Case2` both parse.
    variant_type: ($) =>
      seq(optional("|"), $.variant_case, repeat(seq("|", $.variant_case))),

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

    generic_params: ($) =>
      seq(
        "[",
        seq($.type_param, repeat(seq(",", $.type_param))),
        "]",
      ),

    type_param: ($) =>
      seq($.type_name, optional(seq(":", $.protocol_bound))),

    protocol_bound: ($) =>
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

    // fn(A, B) -> C | Fn(A, B) -> C | (A, B) -> C
    function_type: ($) =>
      choice(
        seq(
          choice("fn", "Fn"),
          "(",
          optional(seq($._type_expr, repeat(seq(",", $._type_expr)))),
          ")",
          "->",
          $._type_expr,
        ),
        seq(
          "(",
          optional(seq($._type_expr, repeat(seq(",", $._type_expr)))),
          ")",
          "->",
          $._type_expr,
        ),
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

    protocol_declaration: ($) =>
      seq(
        "protocol",
        $.type_name,
        optional($.generic_params),
        "{",
        repeat($.protocol_method),
        "}",
      ),

    protocol_method: ($) =>
      seq(
        optional("effect"),
        "fn",
        $.function_name,
        optional($.generic_params),
        $.parameter_list,
        "->",
        $._type_expr,
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
          optional(","),
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

    // guard cond else body | guard let name = expr else body
    guard_statement: ($) =>
      choice(
        seq("guard", $.expression, "else", $._guard_else_body),
        seq(
          "guard",
          "let",
          $.identifier,
          "=",
          $.expression,
          "else",
          $._guard_else_body,
        ),
      ),

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
        $.compose_expression,
        $.call_expression,
        $.member_expression,
        $.optional_chain_expression,
        $.tuple_index_expression,
        $.index_expression,
        $.unwrap_expression,
        $.to_option_expression,
        $.unwrap_or_expression,
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
        $.for_in_expression,
        $.while_expression,
        $.fan_expression,
        $.lambda_expression,
        $.some_expression,
        $.none_expression,
        $.ok_expression,
        $.err_expression,
        $.hole_expression,
        $.todo_expression,
        $.break_expression,
        $.continue_expression,
        $.parenthesized_expression,
      ),

    // Decimal (with _ separators) and hex. No binary/octal in Almide.
    integer_literal: ($) =>
      token(choice(/[0-9][0-9_]*/, /0[xX][0-9a-fA-F][0-9a-fA-F_]*/)),

    // 3.14, 1_0.5, 1e9, 2.5E-3
    float_literal: ($) =>
      token(
        choice(
          /[0-9][0-9_]*\.[0-9][0-9_]*([eE][+-]?[0-9]+)?/,
          /[0-9][0-9_]*[eE][+-]?[0-9]+/,
        ),
      ),

    string_literal: ($) =>
      choice(
        seq(
          "\"",
          repeat(
            choice($.escape_sequence, $.string_interpolation, $.string_content),
          ),
          "\"",
        ),
        $.single_quote_string,
        $.raw_string,
      ),

    // escapes only, no interpolation
    single_quote_string: ($) => token(seq("'", /([^'\\]|\\.)*/, "'")),

    string_content: ($) => /[^"\$]+|\$/,

    raw_string: ($) => token(seq("r\"", /[^"]*/, "\"")),

    string_interpolation: ($) => seq("${", $.expression, "}"),

    heredoc_string: ($) =>
      token(
        choice(
          seq("\"\"\"", /([^"]|"[^"]|""[^"])*/, "\"\"\""),
          seq("r\"\"\"", /([^"]|"[^"]|""[^"])*/, "\"\"\""),
        ),
      ),

    // \n \t \r \\ \" \$ ; \xNN (2 hex digits); \u{...} (1-6 hex digits).
    // A malformed numeric escape is left literal -- handled by falling
    // through to string_content, since this rule simply won't match it.
    escape_sequence: ($) => /\\([nrt"$\\]|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\})/,

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
      prec.dynamic(-10, prec(PREC.postfix, seq(
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
        $._match_compose,
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
        prec.left(PREC.or, seq(field("left", $._match_value), field("operator", "or"), field("right", $._match_value))),
        prec.left(PREC.and, seq(field("left", $._match_value), field("operator", "and"), field("right", $._match_value))),
        prec.left(PREC.compare, seq(field("left", $._match_value), field("operator", "=="), field("right", $._match_value))),
        prec.left(PREC.compare, seq(field("left", $._match_value), field("operator", "!="), field("right", $._match_value))),
        prec.left(PREC.compare, seq(field("left", $._match_value), field("operator", "<"), field("right", $._match_value))),
        prec.left(PREC.compare, seq(field("left", $._match_value), field("operator", ">"), field("right", $._match_value))),
        prec.left(PREC.compare, seq(field("left", $._match_value), field("operator", "<="), field("right", $._match_value))),
        prec.left(PREC.compare, seq(field("left", $._match_value), field("operator", ">="), field("right", $._match_value))),
        prec.left(PREC.add, seq(field("left", $._match_value), field("operator", "+"), field("right", $._match_value))),
        prec.left(PREC.add, seq(field("left", $._match_value), field("operator", "-"), field("right", $._match_value))),
        prec.left(PREC.multiply, seq(field("left", $._match_value), field("operator", "*"), field("right", $._match_value))),
        prec.left(PREC.multiply, seq(field("left", $._match_value), field("operator", "/"), field("right", $._match_value))),
        prec.left(PREC.multiply, seq(field("left", $._match_value), field("operator", "%"), field("right", $._match_value))),
        prec.right(PREC.power, seq(field("left", $._match_value), field("operator", choice("^", "**")), field("right", $._match_value))),
      ),

    _match_unary: ($) =>
      prec(PREC.unary, seq(field("operator", choice("not", "-")), field("operand", $._match_value))),

    _match_pipe: ($) =>
      prec.left(PREC.pipe, seq(field("left", $._match_value), "|>", field("right", $._pipe_rhs))),

    _match_compose: ($) =>
      prec.left(PREC.compose, seq(field("left", $._match_value), ">>", field("right", $._match_value))),


    _match_call: ($) =>
      prec.left(PREC.postfix, seq($._match_value, optional($.turbofish), $.argument_list)),

    _match_member: ($) =>
      prec.left(PREC.postfix, seq($._match_value, ".", choice($.identifier, $.predicate_identifier))),

    _match_tuple_index: ($) =>
      prec.left(PREC.postfix, seq($._match_value, ".", $.integer_literal)),

    _match_index: ($) =>
      prec.left(PREC.postfix, seq($._match_value, "[", $.expression, "]")),

    _match_range: ($) =>
      prec.left(PREC.range, seq($._match_value, choice("..<", "..."), $._match_value)),

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


    for_in_expression: ($) =>
      seq(
        "for",
        choice(
          $._for_binder,
          seq(
            "(",
            $._for_binder,
            repeat1(seq(",", $._for_binder)),
            ")",
          ),
        ),
        "in",
        $.expression,
        $.block_expression,
      ),

    _for_binder: ($) => choice($.identifier, "_"),

    while_expression: ($) =>
      seq("while", field("condition", $.expression), $.block_expression),

    fan_expression: ($) =>
      seq("fan", $.block_expression),

    lambda_expression: ($) =>
      prec.right(1, seq(
        "(",
        optional(
          seq($.lambda_param, repeat(seq(",", $.lambda_param))),
        ),
        ")",
        "=>",
        $.expression,
      )),

    lambda_param: ($) =>
      choice(seq($.identifier, ":", $._type_expr), $.identifier, "_"),

    // call_expression: left-recursive via $.expression
    call_expression: ($) =>
      prec.left(
        PREC.postfix,
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
    // Postfix ops `. () [] ! ? ?. ??` bind tighter than unary `not -`.
    member_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq(
          $.expression,
          ".",
          choice($.identifier, $.predicate_identifier),
        ),
      ),

    // tuple_index_expression: left-recursive via $.expression
    tuple_index_expression: ($) =>
      prec.left(PREC.postfix, seq($.expression, ".", $.integer_literal)),

    // index_expression: left-recursive via $.expression
    index_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq($.expression, "[", $.expression, "]"),
      ),

    binary_expression: ($) =>
      choice(
        prec.left(PREC.or, seq(field("left", $.expression), field("operator", "or"), field("right", $.expression))),
        prec.left(PREC.and, seq(field("left", $.expression), field("operator", "and"), field("right", $.expression))),
        prec.left(PREC.compare, seq(field("left", $.expression), field("operator", "=="), field("right", $.expression))),
        prec.left(PREC.compare, seq(field("left", $.expression), field("operator", "!="), field("right", $.expression))),
        prec.left(PREC.compare, seq(field("left", $.expression), field("operator", "<"), field("right", $.expression))),
        prec.left(PREC.compare, seq(field("left", $.expression), field("operator", ">"), field("right", $.expression))),
        prec.left(PREC.compare, seq(field("left", $.expression), field("operator", "<="), field("right", $.expression))),
        prec.left(PREC.compare, seq(field("left", $.expression), field("operator", ">="), field("right", $.expression))),
        prec.left(PREC.add, seq(field("left", $.expression), field("operator", "+"), field("right", $.expression))),
        prec.left(PREC.add, seq(field("left", $.expression), field("operator", "-"), field("right", $.expression))),
        prec.left(PREC.multiply, seq(field("left", $.expression), field("operator", "*"), field("right", $.expression))),
        prec.left(PREC.multiply, seq(field("left", $.expression), field("operator", "/"), field("right", $.expression))),
        prec.left(PREC.multiply, seq(field("left", $.expression), field("operator", "%"), field("right", $.expression))),
        prec.right(PREC.power, seq(field("left", $.expression), field("operator", choice("^", "**")), field("right", $.expression))),
      ),

    unary_expression: ($) =>
      prec(
        PREC.unary,
        seq(
          field("operator", choice("not", "-")),
          field("operand", $.expression),
        ),
      ),

    // xs |> f — left-assoc chaining; the RHS is a single postfix/compose
    // chain, so `xs |> f + ys` parses as `(xs |> f) + ys` (compiler behavior).
    pipe_expression: ($) =>
      prec.left(
        PREC.pipe,
        seq(
          field("left", $.expression),
          "|>",
          field("right", $._pipe_rhs),
        ),
      ),

    // The pipe RHS is a CLOSED postfix/compose chain (same technique as the
    // _match_* family): it never recurses through $.expression, so a binary
    // operator after it can only apply to the whole pipe — `xs |> f + ys`
    // parses as `(xs |> f) + ys`, exactly like the compiler.
    _pipe_rhs: ($) =>
      choice(
        $._pipe_compose,
        $._pipe_call,
        $._pipe_member,
        $._pipe_optional_chain,
        $._pipe_tuple_index,
        $._pipe_index,
        $._pipe_unwrap,
        $._pipe_to_option,
        $.pipe_match_expression,
        $.primary_expression,
      ),

    _pipe_compose: ($) =>
      prec.dynamic(1, prec.left(PREC.compose, seq($._pipe_rhs, ">>", $._pipe_rhs))),

    _pipe_call: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, optional($.turbofish), $.argument_list))),

    _pipe_member: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, ".", choice($.identifier, $.predicate_identifier)))),

    _pipe_optional_chain: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, "?.", choice($.identifier, $.predicate_identifier)))),

    _pipe_tuple_index: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, ".", $.integer_literal))),

    _pipe_index: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, "[", $.expression, "]"))),

    _pipe_unwrap: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, "!"))),

    _pipe_to_option: ($) =>
      prec.dynamic(1, prec.left(PREC.postfix, seq($._pipe_rhs, token.immediate("?")))),

    // x |> match { arms } — subjectless match fed by the pipe
    pipe_match_expression: ($) =>
      seq("match", "{", repeat1(seq($.match_arm, optional(","))), "}"),

    // f >> g — function composition; the tightest binary operator
    compose_expression: ($) =>
      prec.left(
        PREC.compose,
        seq(
          field("left", $.expression),
          ">>",
          field("right", $.expression),
        ),
      ),

    // expr! — unwrap (error propagation in effect fn)
    unwrap_expression: ($) =>
      prec.left(PREC.postfix, seq($.expression, "!")),

    // expr? — convert Result to Option
    to_option_expression: ($) =>
      prec.left(PREC.postfix, seq($.expression, token.immediate("?"))),

    // expr ?? fallback — unwrap with default; the fallback binds at unary
    // level, so `x ?? 0 + 1` parses as `(x ?? 0) + 1` (compiler behavior).
    unwrap_or_expression: ($) =>
      prec.left(PREC.postfix, seq($.expression, "??", $._coalesce_fallback)),

    // Closed chain: the fallback is a single unary-level expression.
    _coalesce_fallback: ($) =>
      choice(
        $._coalesce_unary,
        $._pipe_call,
        $._pipe_member,
        $._pipe_optional_chain,
        $._pipe_tuple_index,
        $._pipe_index,
        $._pipe_unwrap,
        $._pipe_to_option,
        $.primary_expression,
      ),

    _coalesce_unary: ($) =>
      prec(PREC.unary, seq(choice("not", "-"), $._coalesce_fallback)),

    // expr?.field — optional chaining
    optional_chain_expression: ($) =>
      prec.left(PREC.postfix, seq($.expression, "?.", choice($.identifier, $.predicate_identifier))),

    // else is optional: `if c then a` evaluates to Unit when c is false
    if_expression: ($) =>
      prec.right(seq(
        "if",
        field("condition", $.expression),
        "then",
        field("consequence", $.expression),
        optional(seq("else", field("alternative", $.expression))),
      )),

    some_expression: ($) => seq("some", "(", $.expression, ")"),

    none_expression: ($) => "none",

    ok_expression: ($) => seq("ok", "(", $.expression, ")"),

    err_expression: ($) => seq("err", "(", $.expression, ")"),

    hole_expression: ($) => "_",

    todo_expression: ($) =>
      seq("todo", "(", optional($.string_literal), ")"),

    break_expression: ($) => "break",

    continue_expression: ($) => "continue",

    range_expression: ($) =>
      prec.left(
        PREC.range,
        seq($._range_operand, choice("..<", "..."), $._range_operand),
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
        $.list_pattern,
        $.as_pattern,
      ),

    // all @ [a, ..t] / c @ Circle(r) — bind the whole value and destructure it.
    // `@` here is the binder, distinct from the `@name` attribute token (which
    // is only lexed in declaration position, never after a pattern identifier).
    as_pattern: ($) =>
      prec.right(2, seq(
        field("name", $.identifier),
        "@",
        field("pattern", $.pattern),
      )),

    wildcard_pattern: ($) => prec(1, "_"),

    identifier_pattern: ($) => prec(1, $.identifier),

    type_name_pattern: ($) => prec(1, $.type_name),

    literal_pattern: ($) =>
      prec(1, choice(
        $.integer_literal,
        $.float_literal,
        $.string_literal,
        $.boolean_literal,
        seq("-", choice($.integer_literal, $.float_literal)),
      )),

    some_pattern: ($) => prec(1, seq("some", "(", $.pattern, ")")),

    none_pattern: ($) => prec(1, "none"),

    ok_pattern: ($) => prec(1, seq("ok", "(", $.pattern, ")")),

    err_pattern: ($) => prec(1, seq("err", "(", $.pattern, ")")),

    constructor_pattern: ($) =>
      prec(1, seq(
        $.type_name,
        "(",
        optional(seq($.pattern, repeat(seq(",", $.pattern)))),
        ")",
      )),

    // Match { scope, regex } or Match { scope, .. } or Match { .. }
    variant_record_pattern: ($) =>
      prec(1, seq(
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
      )),

    record_pattern: ($) =>
      prec(1, seq(
        "{",
        seq($.identifier, repeat(seq(",", $.identifier))),
        optional(seq(",", "..")),
        optional(","),
        "}",
      )),

    tuple_pattern: ($) =>
      prec(1, seq(
        "(",
        $.pattern,
        ",",
        seq($.pattern, repeat(seq(",", $.pattern))),
        ")",
      )),

    // [1, 2, 3] / [h, ..t] / [a, b, ..] / [..all] — the rest element is only
    // valid in the last slot (the compiler rejects `[..t, x]`, so does the grammar).
    list_pattern: ($) =>
      prec(1, seq(
        "[",
        optional(choice(
          seq(
            $.pattern,
            repeat(seq(",", $.pattern)),
            optional(seq(",", $.rest_pattern)),
          ),
          $.rest_pattern,
        )),
        "]",
      )),

    // `..` (rest ignored) or `..name` (rest bound to a List)
    rest_pattern: ($) => seq("..", optional(field("name", $.identifier))),

    // ── Terminals ──

    line_comment: ($) => /\/\/[^\n]*/,

    // /* ... */ — nestable in the compiler; approximated as non-nested here
    block_comment: ($) => token(seq("/*", /([^*]|\*[^/])*/, "*/")),

    identifier: ($) => /[a-z_][a-zA-Z0-9_]*/,

    type_name: ($) => /[A-Z][a-zA-Z0-9_]*/,
  },
});
