import { advanceTextPosition, assignTextPosition, cloneTextPosition, TextPosition } from "./text-pos";

export type Parser = {
	text: string;
	pos:  TextPosition;
}

export function newParser(code: string): Parser {
	return {
		text: code,
		pos: {
			i:  0,
			line: 0,
			col:  0,
			tabs: 0,
		},
	};
}

export function currentChar(r: Parser, offset = 0) {
    return r.text[r.pos.i + offset] ?? "";
}

export function reachedEnd(r: Parser) {
    return r.pos.i >= r.text.length;
}


export function advanceToNextNewLine(r: Parser) {
    while (advance(r) && currentChar(r) !== "\n") { }
}

export function compareCurrent(r: Parser, str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const pos = r.pos.i + i;
        if (pos >= r.text.length)   return false;
        if (r.text[pos] !== str[i]) return false;
    }

    return true;
}

export function advance(r: Parser) {
	return advanceTextPosition(r.pos, r.text);
}

export function advanceBy(r: Parser, count: number) {
	for (let i = 0; i < count; i++) {
		advance(r);
	}
}

export function reset(r: Parser, pos: TextPosition) {
	assignTextPosition(r.pos, pos);
}

export function parserPos(r: Parser): TextPosition {
	return cloneTextPosition(r.pos);
}
