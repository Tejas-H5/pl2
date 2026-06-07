export type TextPosition = {
    i:    number;
    line: number;
    col:  number;
    tabs: number;     // we need this to correctly get a screen position, since tabs might have a different size.
};

export function newTextPosition(i: number, line: number, col: number, tabs: number): TextPosition {
    return { i, line, col, tabs: tabs };
}

export function cloneTextPosition(pos: TextPosition): TextPosition {
	return { 
		i:    pos.i,
		line: pos.line,
		col:  pos.col,
		tabs: pos.tabs,     // we need this to correctly get a screen position, since tabs might have a different size.
	};
}

export function assignTextPosition(dst: TextPosition, src: TextPosition) {
	dst.i    = src.i;
	dst.line = src.line;
	dst.col  = src.col;
	dst.tabs = src.tabs;
}

// Returns true if we've reached the end of the text.
export function advanceTextPosition(pos: TextPosition, text: string) {
    const c = text[pos.i];
	if (!c) {
		return true;
	}

    if (c === "\n") {
        pos.line++;
        pos.col = 0;
        pos.tabs = 0;
    } else if (c === "\t") {
        pos.tabs++;
    } else {
        pos.col++;
    }

    pos.i++;

    return pos.i >= text.length;
}


