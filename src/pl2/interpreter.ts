import { Program } from "./ast";
import { Parser } from "./parser";

export const PROGRAM_OUTPUT_VARIABLE = 0;

export type ProgramOutputType
	= typeof PROGRAM_OUTPUT_VARIABLE;

type ProgramOutputBase = {
	type: ProgramOutputType;
}

type ProgramOutputVariable = ProgramOutputBase & {
	type: typeof PROGRAM_OUTPUT_VARIABLE;
	value: ProgramValue;
};

export type ProgramOutput
	= ProgramOutputVariable;

export type ProgramResult = {
	output: ProgramOutput[];
}

export type ProgramValue = {
}

export function newProgramResult(): ProgramResult {
	return {
		output: [],
	};
}

export function interpretProgram(program: Program) {
	const result = newProgramResult();

	return result;
}

