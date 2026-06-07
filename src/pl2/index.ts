import { parseProgram } from "./ast";
import { interpretProgram, ProgramResult } from "./interpreter";
import { newParser } from "./parser";

export function runProgram(code: string): ProgramResult {
	const parser = newParser(code);
	const program = parseProgram(parser);
	const result = interpretProgram(program);
	return result;
}
