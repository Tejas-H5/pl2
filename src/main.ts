import { im, ImCache, imdom } from "im-js";
import { BLOCK, COL, imui, ROW } from "im-ui";
import { ast, pl2 } from "pl2";
import { imHandleTextAreaEvent, imTextAreaBegin, imTextAreaEnd } from "/im-ui/editable-text-area";
import {
	imBegin,
	imCodeBegin,
	imCodeEnd,
	imCodeSpanBegin,
	imCodeSpanEnd,
	imEnd,
	imFlex,
	imHeading,
	imStr,
	imSubHeading
} from "ui-primitives";

const c: ImCache = []
imMain(c);
imui.init();

function imMain(c: ImCache) {
	im.CacheBegin(c, imMain); {
		imdom.RootBegin(c, document.body); {
			const ev = imdom.GlobalEventSystemBegin(c); {
				imApp(c);
			} imdom.GlobalEventSystemEnd(c, ev);
		} imdom.RootEnd(c, document.body);
	} im.CacheEnd(c);
}

function imApp(c: ImCache) {
	if (im.isFirstishRender(c)) {
		imdom.setStyle(c, "fontFamily", "Inter")
		imdom.setStyle(c, "fontSize", "1.2em")
	}

	const state = im.GetInline(c, imApp) ?? im.Set(c, {
		code: localStorage.getItem("temp") ?? "",
		codeVersion: 0,
	});

	imBegin(c, ROW); {
		imBegin(c, COL); imFlex(c); {
			imHeading(c, "Code");
			const ev = imCodeEditor(c, state.code);
			if (ev) {
				if (ev.newCode !== undefined) {
					state.code = ev.newCode;
					localStorage.setItem("temp", ev.newCode);
					state.codeVersion += 1;
				}
			}
		} imEnd(c);
		imBegin(c, COL); imFlex(c); {
			imHeading(c, "Output");

			imCodeOutput(c, state.code, state.codeVersion);
		} imEnd(c);
	} imEnd(c);
}

type CodeEditorEv = {
	newCode: string | undefined;
}

function imCodeEditor(c: ImCache, code: string): CodeEditorEv | undefined {
	let result: CodeEditorEv | undefined;

	imCodeBegin(c); {
		const [, textArea] = imTextAreaBegin(c, { value: code }); {
			const ev = imHandleTextAreaEvent(c, textArea);
			if (ev) {
				if (ev.newText !== undefined) {
					result = { newCode: ev.newText }
				}
			}
		} imTextAreaEnd(c);
	} imCodeEnd(c); 

	return result;
}

function imCodeOutput(c: ImCache, code: string, codeVersion: number) {
	const output =
		im.GetInline(c, imApp) ??
		im.Set(c, { val: pl2.interpretCode("") });

	if (im.Memo(c, codeVersion)) {
		output.val = pl2.interpretCode(code);
	}

	const interpretResult = output.val;

	if (im.If(c) && interpretResult.errors.length > 0) {
		imHeading(c, "Errors");

		im.For(c); for (const err of interpretResult.errors) {
			imBegin(c, BLOCK); {
				imCodeSpanBegin(c); {
					if (im.If(c) && err.expr) {
						imStr(c, ast.expressionToString(code, err.expr));
					} else {
						im.IfElse(c);

						let start = Math.max(0, err.pos.i - 10);
						const end = err.pos.i + 1;
						imStr(c, code.substring(start, end));
						imStr(c, "_<- ");
					} im.IfEnd(c);
				} imCodeSpanEnd(c);

				imStr(c, err.message);
			} imEnd(c);
		} im.ForEnd(c);
	} else if (im.ElseIf(c)) {
		im.For(c); for (const output of interpretResult.logOutputs) {
			imBegin(c, BLOCK); {
				imStr(c, ast.expressionToString(code, output.expr));
				imStr(c, " -> ");
				imStr(c, output.text);
			} imEnd(c);
		} im.ForEnd(c)
		if (im.If(c) && interpretResult.logOutputs.length === 0) {
			imStr(c, "No strings yet");
		} im.IfEnd(c);

		imSubHeading(c, "Variables");

		const globalScope = output.val.scopes[0];
		im.For(c); for (const [name, value] of globalScope.vars) {
			imBegin(c, BLOCK); {
				imCodeSpanBegin(c); imStr(c, name); imCodeSpanEnd(c);
				imStr(c, " -> ");
				imCodeSpanBegin(c); imStr(c, pl2.resultToString(value)); imCodeSpanEnd(c);
				imStr(c, " | ");
				imStr(c, pl2.resultTypeToString(value.type));
			} imEnd(c);
		} im.ForEnd(c);
		if (im.If(c) && globalScope.vars.size === 0) {
			imStr(c, "No variables defined yet");
		} im.IfEnd(c);
	} im.IfEnd(c);
}
