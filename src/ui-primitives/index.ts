import { INTER_FONT_CSS } from "fonts/inter";
import { el, im, ImCache, imdom } from "im-js";
import { BLOCK, cssVars, DisplayType, imui, INLINE, LEFT } from "im-ui";

// Experiment: We should only be using the stuff in here to build the majority of the code here.
// It can be bespoke custom stuff, or even just a wrapper over imui.

const cssb = imui.newCssBuilder();
cssb.s(INTER_FONT_CSS);
cssb.s(`

textarea {
    all: unset;
    font-family: MainGameFont;
    white-space: pre-wrap;
    padding: 5px;
}

textarea:focus {
    background-color: ${cssVars.bg};
}

input {
    all: unset;
    font-family: MainGameFont;
    white-space: pre-wrap;
}

input:focus {
    background-color: ${cssVars.bg};
}

h1, h2, h3, h4 { margin: 0; }

`);


export function imHeading(c: ImCache, text: string) {
	imdom.ElBegin(c, el.H2); {
		imStr(c, text);
	} imdom.ElEnd(c, el.H2);
}

export function imSubHeading(c: ImCache, text: string) {
	imdom.ElBegin(c, el.H3); {
		imStr(c, text);
	} imdom.ElEnd(c, el.H3);
}

export function imBegin(c: ImCache, type: DisplayType, align = LEFT) {
	const result = imui.Begin(c, type);
	imui.Align(c, align);
	return result;
}

export const imEnd   = imui.End;
export const imFlex  = imui.Flex;
export const imStr   = imdom.Str;

export function imCodeBegin(c: ImCache) {
    const result = imBegin(c, BLOCK); // Prevent style leaking out
	if (im.isFirstishRender(c)) {
		imdom.setStyle(c, "fontFamily", "monospace")
		imdom.setStyle(c, "whiteSpace", "nowrap")
		imdom.setStyle(c, "tabSize", "4")
	}
	return result;
}

export function imCodeEnd(c: ImCache) {
	imEnd(c);
}

export function imCodeSpanBegin(c: ImCache) {
    const result = imBegin(c, INLINE); { // Prevent style leaking out
		if (im.isFirstishRender(c)) {
			imdom.setStyle(c, "padding", "0px 5px")
		}

		imBegin(c, INLINE);  {
			if (im.isFirstishRender(c)) {
				imdom.setStyle(c, "fontFamily", "monospace")
				imdom.setStyle(c, "whiteSpace", "nowrap")
				imdom.setStyle(c, "tabSize", "4")
				imdom.setStyle(c, "background", cssVars.bg2)
			}
		} // imEnd
	} // imEnd

	return result;
}

export function imCodeSpanEnd(c: ImCache) {
	imEnd(c);
	imEnd(c);
}

export const imGap = imui.Gap;
