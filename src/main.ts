import { im, ImCache, imdom } from "im-js";
import { BLOCK, CENTER, COL, cssVars, imui, ROW } from "im-ui";
import { ast, pl2 } from "pl2";
import {
	imB,
	imBegin,
	imButtonBegin,
	imButtonEnd,
	imCodeBegin,
	imCodeEnd,
	imCodeSpanBegin,
	imCodeSpanEnd,
	imEnd,
	imFlex,
	imHeading,
	imHSpace,
	imPreWrap,
	imStr,
	imStrFmt,
	imSubHeading,
	imVDivider,
	imVSpace
} from "ui-primitives";
import { imHandleTextAreaEvent, imTextAreaBegin, imTextAreaEnd } from "/im-ui/editable-text-area";

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

type AppState = {
	cells: CodeCellState[];
}

function loadState(): AppState | undefined {
	const val = localStorage.getItem("state");
	if (!val) {
		return undefined;
	}

	try {
		const loaded = JSON.parse(val);
		return loaded as AppState;
	} catch(err) {
		console.error(err);
	}

	return undefined;
}

function saveState(state: AppState) {
	const json = JSON.stringify(state);
	localStorage.setItem("state", json);
}

let debounceTimeout = 0;
let saveStartedAt   = 0;
let saving          = false;
function saveStateDebounced(state: AppState) {
	saveStartedAt = Date.now();
	saving        = true;

	clearTimeout(debounceTimeout);
	debounceTimeout = setTimeout(() => {
		saveState(state);
		saving = false;
	}, 1000);
}

function newAppState(): AppState {
	const loaded = loadState();
	if (loaded) {
		return loaded
	}

	return {
		cells: [],
	};
}

function imApp(c: ImCache) {
	if (im.isFirstishRender(c)) {
		imdom.setStyle(c, "fontFamily", "Inter")
		imdom.setStyle(c, "fontSize", "1.2em")
	}

	const state = im.State(c, newAppState);

	imBegin(c, ROW, CENTER); {
		imHeading(c, "PL2");

		imBegin(c, BLOCK); imFlex(c); imEnd(c);

		imStr(c, state.cells.length);
		imStr(c, " ");
		imStr(c, state.cells.length === 1 ? "cell" : "cells");

		imBegin(c, BLOCK); imFlex(c); imEnd(c);

		if (im.If(c) && saving) {
			imStr(c, "Saving...");
		} else {
			imStr(c, "Saved");
		} im.IfEnd(c);
	} imEnd(c);

	let deferredEvent: (() => void) | undefined;

	im.For(c); for (let idx = 0; idx < state.cells.length; idx++) {
		const cellState = state.cells[idx];

		imCodeCell(c, cellState);

		imVSpace(c, cssVars.bg)

		imBegin(c, ROW, CENTER, CENTER); {
			imButtonBegin(c, ROW); {
				imStr(c, "-"); 
				if (imdom.hasMousePress(c)) {
					deferredEvent = () => {
						state.cells.splice(idx, 1);
						saveStateDebounced(state);
					}
				}
			} imButtonEnd(c);

			imHSpace(c, cssVars.bg);

			imButtonBegin(c, ROW); {
				imStr(c, "+"); 
				if (imdom.hasMousePress(c)) {
					deferredEvent = () => {
						state.cells.splice(idx + 1, 0, newCodeCellState());
						saveStateDebounced(state);
					}
				}
			} imButtonEnd(c);
		} imEnd(c);

		imVSpace(c, cssVars.bg)

		if (im.Memo(c, cellState.codeVersion)) {
			saveStateDebounced(state);
		}
	} im.ForEnd(c);

	im.If(c); if (state.cells.length === 0) {
		imBegin(c, ROW, CENTER, CENTER); {
			imButtonBegin(c, ROW); {
				imStr(c, "+"); 
				if (imdom.hasMousePress(c)) {
					console.log("hi")
					deferredEvent = () => {
						state.cells.push(newCodeCellState());
						saveStateDebounced(state);
					}
				}
			} imButtonEnd(c);
		} imEnd(c);
	} im.IfEnd(c);

	if (deferredEvent) {
		deferredEvent();
	}
}

type CodeCellState = {
	code:        string;
	codeVersion: number;
};

function parseIntOrZero(text: string | null | undefined): number {
	if (!text) {
		return 0;
	}

	let val = parseInt(text);
	if (Number.isNaN(val)) {
		return 0;
	}

	return val;
}

function getCellKey(cellBucket: string, idx: number): string {
	return cellBucket + "-" + idx;
}

function newCodeCellState(): CodeCellState {
	return {
		code: "",
		codeVersion: 0,
	};
}

function imCodeCell(c: ImCache, state: CodeCellState): CodeCellState {
	imBegin(c, ROW); {
		if (im.isFirstishRender(c)) {
			imdom.setStyle(c, "maxHeight", "80vh");
			imdom.setStyle(c, "overflow", "auto");
		}

		imBegin(c, COL); imFlex(c); {
			const ev = imCodeEditor(c, state.code);
			if (ev) {
				if (ev.newCode !== undefined) {
					state.code = ev.newCode;
					state.codeVersion += 1;
				}
			}
		} imEnd(c);

		imHSpace(c, cssVars.bg);

		imBegin(c, COL); imFlex(c); {
			imCodeOutput(c, state.code, state.codeVersion);
		} imEnd(c);
	} imEnd(c);

	return state;
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
	const output = im.GetInline(c, imApp) ?? im.Set(c, {
		val:      pl2.interpretCode(""),
		evalTime: 0,
	});

	if (im.Memo(c, codeVersion)) {
		const t0        = performance.now();
		output.val      = pl2.interpretCode(code);
		output.evalTime = performance.now() - t0;
	}

	const interpretResult = output.val;

	if (im.If(c) && interpretResult.errors.length > 0) {
		im.For(c); for (const err of interpretResult.errors) {
			imBegin(c, ROW); imPreWrap(c); {
				imCodeSpanBegin(c); {
					if (im.If(c) && err.expr) {
						imStr(c, ast.expressionToString(code, err.expr));
					} else {
						im.IfElse(c);

						let start = Math.max(0, err.pos.i - 10);
						const end = err.pos.i + 1;
						imStr(c, code.substring(start, end));
					} im.IfEnd(c);
				} imCodeSpanEnd(c);

				imHSpace(c, cssVars.bg);

				imStr(c, err.message);
			} imEnd(c);
		} im.ForEnd(c);
	} else if (im.ElseIf(c)) {
		// imStr(c, "Ran in "); imStr(c, Math.round(output.evalTime)); imStr(c, "ms");

		if (im.If(c) && interpretResult.printOutputs.length > 0) {
			imCodeBegin(c); {
				im.For(c); for (const p of interpretResult.printOutputs) {
					imStr(c, p);
				} im.ForEnd(c);
			} imCodeEnd(c);
		} im.IfEnd(c);

		const globalVars = interpretResult.scopes[0].vars;
		if (im.If(c) && globalVars.size > 0) {
			imVDivider(c);

			im.For(c); for (const [k, v] of globalVars) {
				imBegin(c, BLOCK); {
					imCodeSpanBegin(c); {
						imStr(c, k);
					} imCodeSpanEnd(c);
					imStr(c, " = ");
					imStrFmt(c, v, pl2.resultToString);
					imStr(c, " | ");
					imStr(c, pl2.resultTypeToString(v.type));
				} imEnd(c);
			} im.ForEnd(c)
		} im.IfEnd(c);

		if (im.If(c) && interpretResult.logOutputs.length > 0) {
			imVDivider(c);

			im.For(c); for (const output of interpretResult.logOutputs) {
				imBegin(c, BLOCK); {
					imCodeSpanBegin(c); {
						imStr(c, ast.expressionToString(code, output.expr));
					} imCodeSpanEnd(c);
					imStr(c, " -> ");
					imStr(c, output.text);
					imStr(c, " | ");
					imStr(c, pl2.resultTypeToString(output.result.type));
				} imEnd(c);
			} im.ForEnd(c)
		} im.IfEnd(c);

		if (im.If(c) && interpretResult.dataOutputs.length > 0) {
			im.For(c); for (const output of interpretResult.dataOutputs) {
				imSubHeading(c, output.title);
				imBegin(c, BLOCK); {
					if (im.Memo(c, output.axes.length)) {
						imdom.setStyle(c, "display", "grid");
						imdom.setStyle(c, "gridTemplateColumns", "1fr ".repeat(output.axes.length));
					}

					im.For(c); for (const axis of output.axes) {
						imBegin(c, BLOCK); imB(c); {
							imStr(c, axis.name);
						} imEnd(c);
					} im.ForEnd(c);

					let numDataPoints = 0;
					for (const axis of output.axes) {
						numDataPoints = Math.max(numDataPoints, axis.numbers.length);
					}

					im.For(c); 
					for (let idx = 0; idx < numDataPoints; idx++) {
						for (let axisIdx = 0; axisIdx < output.axes.length; axisIdx++) {

							const axis = output.axes[axisIdx];

							let value = "-";
							if (idx < axis.numbers.length) {
								const num = axis.numbers[idx];
								if (axis.labels) {
									value = axis.labels[num];
								} else {
									value = "" + num;
								}
							}

							imBegin(c, BLOCK); {
								imStr(c, value);
							} imEnd(c);

						}
					}
					im.ForEnd(c);
				} imEnd(c);
			} im.ForEnd(c);
		} im.IfEnd(c);
	} im.IfEnd(c);

}
