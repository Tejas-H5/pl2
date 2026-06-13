import { addTest, addTestGroup, setCurrentTestFile, test, testAssert, testDeepEqual, testEqual } from "src/testing/testing";
import * as ast from "./ast";
import { newParser } from "./parser";

setCurrentTestFile("src/pl2/ast.test.ts");

function isIdentifier(expr: ast.Expression | undefined, name: string): expr is ast.Identifier {
	if (!expr) return false;
	if (expr.type !== ast.Expression_Identifier) return false;
	return expr.name === name;
}

addTestGroup("Parsing identifiers", [ast.parseIdentifier], () => {
	addTest("Identifier", r => {
		const expr = ast.parseExpressionFromText(` henlo `);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_Identifier, "expr.type === EXPR_IDENTIFIER");
		testEqual(r, expr.name, "henlo");
	});

	addTest("Identifier w numbers", r => {
		const expr = ast.parseExpressionFromText(` henlo2 `);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_Identifier, "expr.type === EXPR_IDENTIFIER");
		testEqual(r, expr.name, "henlo2");
	});

	addTest("Identifier cant start with a number", r => {
		const expr = ast.parseExpressionFromText(` 2henlo2 `);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type !== ast.Expression_Identifier);
	});
});

addTestGroup("Operator parsing", [ast.parseOperator], () => {
	addTest("Normal", r => {
		const expr = ast.parseExpressionFromText(`x = y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_BinaryExpression, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: 0, assignment: true });
		testAssert(r, expr.lhs.type === ast.Expression_Identifier, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === ast.Expression_Identifier, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Increment", r => {
		const expr = ast.parseExpressionFromText(`x += y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_BinaryExpression, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: ast.OP_ADD, assignment: true });
		testAssert(r, expr.lhs.type === ast.Expression_Identifier, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === ast.Expression_Identifier, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Add", r => {
		const expr = ast.parseExpressionFromText(`x + y`);
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_BinaryExpression, "expr.type === EXPR_BINARY");
		testDeepEqual(r, expr.op, { type: ast.OP_ADD, assignment: false });
		testAssert(r, expr.lhs.type === ast.Expression_Identifier, "expr.lhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.lhs.name, "x");
		testAssert(r, expr.rhs.type === ast.Expression_Identifier, "expr.rhs.type === EXPR_IDENTIFIER");
		testEqual(r, expr.rhs.name, "y");
	});

	addTest("Invalid operator", r => {
		const parser = newParser("x")
		const result = ast.parseOperator(parser);
		testEqual(r, result, undefined);
	});
})

addTestGroup("Groups", [ast.parseGroup], () => {
	addTest("Groups", r => {
		const expr = ast.parseExpressionFromText("a * (b + c)");
		testAssert(r, !!expr, "0")
		testAssert(r, expr.type === ast.Expression_BinaryExpression);
		test(r, isIdentifier(expr.lhs, "a"))

		testAssert(r, expr.rhs.type === ast.Expression_BinaryExpression);
		test(r, isIdentifier(expr.rhs.lhs, "b"))
		test(r, isIdentifier(expr.rhs.rhs, "c"))
	});
})

addTestGroup("If-chains", [ast.parseIfChain], () => {
	addTest("Single if", r => {
		const expr = ast.parseExpressionFromText(`if a { b c d }`)
		testAssert(r, !!expr);
		testAssert(r, expr.type === ast.Expression_IfChain);
		testEqual(r, expr.else, undefined);
		testEqual(r, expr.blocks.length, 1);
		testEqual(r, expr.blocks[0].block.length, 3);
	})

	addTest("If-else", r => {
		const expr = ast.parseExpressionFromText(`if a { b c d } else { f g }`)
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === ast.Expression_IfChain, "1");
		testEqual(r, expr.else!.length, 2);
		testEqual(r, expr.blocks.length, 1);
		testEqual(r, expr.blocks[0].block.length, 3);
	})

	addTest("If-else-if", r => {
		const expr = ast.parseExpressionFromText(`if a { b c d } else if b { f g } else { h }`)
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === ast.Expression_IfChain, "1");
		testEqual(r, expr.else!.length, 1);
		testEqual(r, expr.blocks.length, 2);
		testEqual(r, expr.blocks[0].block.length, 3);
		testEqual(r, expr.blocks[1].block.length, 2);
	})
});

addTestGroup("For loops", [ast.parseForLoop], () => {
	addTest("lte", r => {
		const expr = ast.parseExpressionFromText("for i in a..<b {}");
		testAssert(r, !!expr, "0")
		testAssert(r, expr.type === ast.Expression_ForLoop, "1")
		testEqual(r, expr.range.rangeType, ast.RANGE_LT);
	});

	addTest("lte", r => {
		const expr = ast.parseExpressionFromText("for i in a..>=b {}");
		testAssert(r, !!expr, "0")
		testAssert(r, expr.type === ast.Expression_ForLoop, "1")
		testEqual(r, expr.range.rangeType, ast.RANGE_GTE);
	});
})

addTestGroup("Return statement", [ast.parseAnyReturnStatement], () => {
	addTest("None", r => {
		const expr = ast.parseExpressionFromText("return()");
		testAssert(r, expr?.type === ast.Expression_Return);
		testEqual(r, expr.expr, undefined)
	});

	addTest("Normal", r => {
		const expr = ast.parseExpressionFromText("return(a)");
		testAssert(r, expr?.type === ast.Expression_Return);
		test(r, isIdentifier(expr.expr!, "a"))
	});

	addTest("With whitespace", r => {
		const expr = ast.parseExpressionFromText(`return
        (
			a
        )`);
		testAssert(r, expr?.type === ast.Expression_Return);
		test(r, isIdentifier(expr.expr!, "a"))
	});
});

addTestGroup("Return statement block", [ast.parseAnyReturnStatement], () => {
	addTest("None", r => {
		const expr = ast.parseExpressionFromText("return{}");
		testAssert(r, expr?.type === ast.Expression_ReturnBlock);
		testEqual(r, expr.block.length, 0)
	});

	addTest("Normal", r => {
		const expr = ast.parseExpressionFromText(`return{
			x = 1
			return(x)
		}`);
		testAssert(r, expr?.type === ast.Expression_ReturnBlock);
		testEqual(r, expr.block.length, 2)
	});

	addTest("Normal", r => {
		const expr = ast.parseExpressionFromText(`return
        {
			x = 1
			return(x)
		}`);
		testAssert(r, expr?.type === ast.Expression_ReturnBlock);
		testEqual(r, expr.block.length, 2)
	});
});

addTestGroup("Binary expressions", [ast.parseExpression, ast.parseBinaryExpression], () => {
	addTest("add", r => {
		const expr = ast.parseExpressionFromText("a + b");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_BinaryExpression);
		test(r, isIdentifier(expr.lhs, "a"))
		test(r, isIdentifier(expr.rhs, "b"))
	});

	addTest("add chain", r => {
		const expr = ast.parseExpressionFromText("a + b + c");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_BinaryExpression);
		testAssert(r, expr.lhs.type === ast.Expression_BinaryExpression);
		test(r, isIdentifier(expr.lhs.lhs, "a"))
		test(r, isIdentifier(expr.lhs.rhs, "b"))
		test(r, isIdentifier(expr.rhs, "c"))
	});

	addTest("precedence parsing", r => {
		const expr = ast.parseExpressionFromText("a * b + c * d");
		testAssert(r, !!expr, "!!expr");

		testAssert(r, expr.type === ast.Expression_BinaryExpression, "0");
		testAssert(r, expr.lhs.type === ast.Expression_BinaryExpression, "1");
		testAssert(r, expr.rhs.type === ast.Expression_BinaryExpression, "2");

		test(r, isIdentifier(expr.lhs.lhs, "a"))
		test(r, isIdentifier(expr.lhs.rhs, "b"))

		test(r, isIdentifier(expr.rhs.lhs, "c"))
		test(r, isIdentifier(expr.rhs.rhs, "d"))
	});

	addTest("precedence parsing 2", r => {
		// NOTE: multiple correct solutions exist...
		const expr = ast.parseExpressionFromText("a + b * c + d");
		testAssert(r, !!expr, "!!expr");

		testAssert(r, expr.type === ast.Expression_BinaryExpression, "0");
		test(r, isIdentifier(expr.lhs, "a"))
		testAssert(r, expr.rhs.type === ast.Expression_BinaryExpression, "1");

		test(r, isIdentifier(expr.rhs.rhs, "d"))
		testAssert(r, expr.rhs.lhs.type === ast.Expression_BinaryExpression, "2");

		test(r, isIdentifier(expr.rhs.lhs.lhs, "b"))
		test(r, isIdentifier(expr.rhs.lhs.rhs, "c"))
	});
});

addTestGroup("Function call arguments", [ast.parseFunctionCall], () => {
	addTest("no args", r => {
		const expr = ast.parseExpressionFromText("a()");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_FunctionCall);
		testEqual(r, expr.name.name, "a");
	})

	addTest("one arg", r => {
		const expr = ast.parseExpressionFromText("a(y)");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_FunctionCall);
		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 1);
		testEqual(r, expr.arguments[0].type, ast.Expression_Identifier);
		testEqual(r, (expr.arguments[0] as ast.Identifier).name, "y");
	})

	addTest("two args", r => {
		const expr = ast.parseExpressionFromText("a(x, y)");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_FunctionCall);
		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 2);
		testEqual(r, expr.arguments[0].type, ast.Expression_Identifier);
		testEqual(r, (expr.arguments[0] as ast.Identifier).name, "x");
		testEqual(r, expr.arguments[1].type, ast.Expression_Identifier);
		testEqual(r, (expr.arguments[1] as ast.Identifier).name, "y");
	})

	addTest("nested calls", r => {
		const expr = ast.parseExpressionFromText("a(b(c()))");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_FunctionCall);

		testEqual(r, expr.name.name, "a");
		testEqual(r, expr.arguments.length, 1);
		testEqual(r, expr.arguments[0].type, ast.Expression_FunctionCall);

		const bFn = (expr.arguments[0] as ast.FunctionCall);
		testEqual(r, bFn.name.name, "b");
		testEqual(r, bFn.arguments.length, 1);

		const cFn = (bFn.arguments[0] as ast.FunctionCall);
		testEqual(r, cFn.name.name, "c");
		testEqual(r, cFn.arguments.length, 0);
	})
});

addTestGroup("Type initializers", [ast.parseTypeArgs, ast.parseTypeInitializer], () => {
	addTest("List", r => {
		const expr = ast.parseExpressionFromText("list<f32>{a, a, a, a}");
		testAssert(r, !!expr, "!!expr");
		testAssert(r, expr.type === ast.Expression_TypeInitializer);
		testAssert(r, !!expr.typeArgs);
		test(r, isIdentifier(expr.typeArgs[0], "f32"));
		testEqual(r, expr.typename.name, "list");
		testEqual(r, expr.args.length, 4);
	})

	addTest("Map", r => {
		const expr = ast.parseExpressionFromText("map<string, f32>{a=b,c=d,e=f}");
		testAssert(r, !!expr, "0");
		testAssert(r, expr.type === ast.Expression_TypeInitializer, "1");

		testAssert(r, !!expr.typeArgs);
		testEqual(r, expr.typeArgs.length, 2);
		testEqual(r, expr.typeArgs[0].name, "string");
		testEqual(r, expr.typeArgs[1].name, "f32");

		testEqual(r, expr.typename.name, "map");
		testEqual(r, expr.args.length, 3);
	})
});

addTestGroup("Number parsing", [ast.parseNumberLiteral, ast.computeNumberForNumberExpression], () => {
	addTest("Zero", r => {
		const expr = ast.parseExpressionFromText("0.00");
		testAssert(r, expr?.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.isNegative, false);
		testEqual(r, expr.val, 0);
		testEqual(r, expr.integerPart, "0");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, undefined)
	});

	addTest("One_e_2", r => {
		const expr = ast.parseExpressionFromText("1.00e2");
		testAssert(r, expr?.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.isNegative, false);
		testEqual(r, expr.val, 100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("+One_e_2", r => {
		const expr = ast.parseExpressionFromText("+1.00e2");
		testAssert(r, expr?.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.isNegative, false);
		testEqual(r, expr.val, 100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("-One_e_2", r => {
		const expr = ast.parseExpressionFromText("-1.00e2");
		testAssert(r, expr?.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.isNegative, true);
		testEqual(r, expr.val, -100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("-One-e_+2", r => {
		const expr = ast.parseExpressionFromText("-1.00e+2");
		testAssert(r, expr?.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.isNegative, true);
		testEqual(r, expr.val, -100);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "2");
	});

	addTest("-One-e_-2", r => {
		const expr = ast.parseExpressionFromText("-1.00e-2");
		testAssert(r, expr?.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.isNegative, true);
		testEqual(r, expr.val, -0.01);
		testEqual(r, expr.integerPart, "1");
		testEqual(r, expr.decimalPart, "00");
		testEqual(r, expr.exponentPart, "-2");
	});

	addTest("0 - -1", r => {
		const expr = ast.parseExpressionFromText("0 - -1");
		testAssert(r, expr?.type === ast.Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, 0);

		testAssert(r, expr.rhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, -1);
	});

	addTest("0 - +1", r => {
		const expr = ast.parseExpressionFromText("0 - +1");
		testAssert(r, expr?.type === ast.Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, 0);

		testAssert(r, expr.rhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, 1);
	});

	addTest("-1 - +0", r => {
		const expr = ast.parseExpressionFromText("-1 - +0");
		testAssert(r, expr?.type === ast.Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, -1);

		testAssert(r, expr.rhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, 0);
	});

	addTest("+1 - +0", r => {
		const expr = ast.parseExpressionFromText("+1 - +0");
		testAssert(r, expr?.type === ast.Expression_BinaryExpression);

		testAssert(r, expr.lhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.lhs.val, 1);

		testAssert(r, expr.rhs.type === ast.Expression_NumberLiteral);
		testEqual(r, expr.rhs.val, 0);
	});

	addTest("+ -1", r => {
		const expr = ast.parseExpressionFromText("+ -1");
		testEqual(r, expr, undefined);
	});

	addTest("- -1", r => {
		const expr = ast.parseExpressionFromText("- -1");
		testEqual(r, expr, undefined);
	});
});


addTestGroup("String parsing", [ast.parseStringLiteral, ast.computeStringForStringLiteral], () => {
	addTest("Normal string", r => {
		const expr = ast.parseExpressionFromText(`"hi"`);
		testAssert(r, expr?.type === ast.Expression_StringLiteral);
		testEqual(r, expr.val, "hi")
	});

	addTest("Empty string", r => {
		const expr = ast.parseExpressionFromText(`""`);
		testAssert(r, expr?.type === ast.Expression_StringLiteral);
		testEqual(r, expr.val, "")
	});

	addTest("Escape sequence - backslash", r => {
		const expr = ast.parseExpressionFromText(`"\\\\"`);
		testAssert(r, expr?.type === ast.Expression_StringLiteral);
		testEqual(r, expr.val, "\\")
	});

	addTest("Escape sequence - quote", r => {
		const expr = ast.parseExpressionFromText(`"\\""`);
		testAssert(r, expr?.type === ast.Expression_StringLiteral);
		testEqual(r, expr.val, "\"")
	});

	addTest("Whitespace", r => {
		const expr = ast.parseExpressionFromText(`"    "`);
		testAssert(r, expr?.type === ast.Expression_StringLiteral);
		testEqual(r, expr.val, "    ")
	});
})


addTestGroup("ParseFunctionDefinition", [ast.parseFunctionDefinition], () => {
	addTest("basic", r => {
		const expr = ast.parseExpressionFromText(`fn(a, b, c) { y = x + 1 return(y) }`);
		testAssert(r, !!expr, "0");
		testAssert(r, expr?.type === ast.Expression_FunctionDefinition, "1");
		testEqual(r, expr.args.length, 3)
		test(r, isIdentifier(expr.args[0].name, "a"))
		test(r, isIdentifier(expr.args[1].name, "b"))
		test(r, isIdentifier(expr.args[2].name, "c"))
		testEqual(r, expr.body.length, 2);
		testEqual(r, expr.body[0].type, ast.Expression_BinaryExpression);
		testEqual(r, expr.body[1].type, ast.Expression_Return);
	})
});

addTestGroup("Complicated parses", [ast.parseProgram], () => {
	addTest("Level 1", r => {
		const program = ast.parseProgramFromText(`
main = fn() {
	println("Hello world")
	return(0)
}
`)
		testAssert(r, program.statements.length === 1);
		testAssert(r, program.statements[0].type === ast.Expression_BinaryExpression);
		testAssert(r, isIdentifier(program.statements[0].lhs, "main"))
		testAssert(r, program.statements[0].rhs.type === ast.Expression_FunctionDefinition)
		testAssert(r, program.statements[0].rhs.args.length === 0)
		testAssert(r, program.statements[0].rhs.body.length === 2)

		testAssert(r, program.statements[0].rhs.body[0].type === ast.Expression_FunctionCall)
		testAssert(r, program.statements[0].rhs.body[0].arguments.length === 1)
		testAssert(r, program.statements[0].rhs.body[0].arguments[0].type === ast.Expression_StringLiteral)
		testAssert(r, program.statements[0].rhs.body[0].arguments[0].val === "Hello world")

		testAssert(r, program.statements[0].rhs.body[1].type === ast.Expression_Return)
		testAssert(r, program.statements[0].rhs.body[1].expr?.type === ast.Expression_NumberLiteral)
		testAssert(r, program.statements[0].rhs.body[1].expr.val === 0)
	});
});

addTestGroup("ast.parseProgram", [ast.parseProgram], () => {
	addTest("Parse a line", r => {
		const program = ast.parseProgramFromText(`x = y`);
		testEqual(r, program.statements.length, 1);
	});

	addTest("Parse two lines", r => {
		// May want to disallow this somehow, but the parser can still handle it. 
		const program = ast.parseProgramFromText(`x = y y = z`);
		testEqual(r, program.statements.length, 2);
	});

	addTest("Parse two lines, different line", r => {
		const program = ast.parseProgramFromText(`x = y\ny = z`);
		testEqual(r, program.statements.length, 2);
	});

	addTest("Multiple lines", r => {
		const program = ast.parseProgramFromText(`
			increment = fn(x) {
				return(x + 1)
			}
			x = increment(2)
`);

		testEqual(r, program.statements.length, 2);
		testAssert(r, program.statements[0].type === ast.Expression_BinaryExpression);
		{
			const fnDef = program.statements[0].rhs;
			testAssert(r, fnDef.type === ast.Expression_FunctionDefinition);
			testEqual(r, fnDef.args.length, 1);
			testEqual(r, fnDef.args[0].name.name, "x");
			testEqual(r, fnDef.body.length, 1);
			testEqual(r, fnDef.body[0].type, ast.Expression_Return);
		}

		testAssert(r, program.statements[1].type === ast.Expression_BinaryExpression);
	});
});

