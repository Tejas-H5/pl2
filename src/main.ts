import { assert, assertNever } from "assert";
import { im, ImCache, imdom } from "im-js";
import { BLOCK, CENTER, COL, cssVars, imui, ROW } from "im-ui";
import { imButtonPressed } from "im-ui/im-button";
import { imC2dBegin, imC2dEnd } from "im-ui/im-canvas2d";
import { ast, pl2 } from "pl2";
import { DataOutput } from "pl2/interpreter";
import { newParser } from "pl2/parser";
import {
	imB,
	imBegin,
	imCodeBegin,
	imCodeEnd,
	imCodeSpanBegin,
	imCodeSpanEnd,
	imEnd,
	imFlex,
	imHeading,
	imHSpace,
	imHSpaceSmall,
	imPreWrap,
	imStr,
	imStrFmt,
	imSubHeading,
	imVDivider,
	imVSpace
} from "ui-primitives";
import * as c2d from "utils/dom/canvas2d";
import * as plt from "utils/dom/canvas2d-plotting";
import { imHandleTextAreaEvent, imTextAreaBegin, imTextAreaEnd } from "/im-ui/editable-text-area";

const ctx: AppContext = {
	cellResults: [],
};

const c: ImCache = []
imMain(c);
imui.init();

function imMain(c: ImCache) {
	im.CacheBegin(c, imMain); {
		imdom.RootBegin(c, document.body); {
			const ev = imdom.GlobalEventSystemBegin(c); {
				const tryCatch = im.Try(c); try {
					const { err } = tryCatch;
					if (im.If(c) && err) {
						imStr(c, "An error occured: " + err);
					} else {
						im.Else(c);
						imApp(c);
					} im.IfEnd(c);
				} catch(e) {
					im.TryCatch(c, tryCatch, e);
				} im.TryEnd(c, tryCatch);
			} imdom.GlobalEventSystemEnd(c, ev);
		} imdom.RootEnd(c, document.body);
	} im.CacheEnd(c);
}

type AppState = {
	cells: CodeCellState[];
}

type AppContext = {
	cellResults: CodeCellOutput[];
};

type CodeCellOutput = {
	iter:         pl2.ProgramIterator;

	environment: {
		width:  number;
		height: number;
	};

	evaluateTime:   number;
	canvasDrawTime: number;
};

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

	let shouldRecompute = false;

	im.For(c); for (let idx = 0; idx < state.cells.length; idx++) {
		const outputs = ctx.cellResults;
		if (idx === outputs.length) {
			outputs.push({
				iter: pl2.interpretCode(""),
				environment: {
					width:  0,
					height: 0,
				},
				evaluateTime: 0,
				canvasDrawTime: 0,
			});
		}

		const cellState       = state.cells[idx];
		const cellStateOutput = outputs[idx];
		imCodeCell(c, cellState, cellStateOutput);

		imVSpace(c, cssVars.bg);

		imBegin(c, ROW, CENTER, CENTER); {
			if (im.If(c) && cellState.code.length === 0) {
				if (imButtonPressed(c, "-")) {
					deferredEvent = () => {
						state.cells.splice(idx, 1);
						saveStateDebounced(state);
					}
				}
			} im.IfEnd(c);

			imHSpace(c, cssVars.bg);

			if (imButtonPressed(c, "+")) {
				deferredEvent = () => {
					state.cells.splice(idx + 1, 0, newCodeCellState());
					saveStateDebounced(state);
				}
			}
		} imEnd(c);

		imVSpace(c, cssVars.bg)

		if (im.Memo(c, cellState.codeVersion)) {
			saveStateDebounced(state);
			shouldRecompute = true;
		}
	} im.ForEnd(c);

	im.If(c); if (state.cells.length === 0) {
		imBegin(c, ROW, CENTER, CENTER); {
			if (imButtonPressed(c, "+")) {
				deferredEvent = () => {
					state.cells.push(newCodeCellState());
					saveStateDebounced(state);
				}
			}
		} imEnd(c);
	} im.IfEnd(c);

	if (deferredEvent) {
		deferredEvent();
	}

	if (shouldRecompute) {
		recocmputeCells(state);
	}
}

function recocmputeCells(state: AppState) {
	for (let idx = 0; idx < state.cells.length; idx++) {
		const cell   = state.cells[idx];
		const result = ctx.cellResults[idx];
		assert(!!cell);
		assert(!!result);

		const environment = new Map<string, pl2.Result>([
			["screen_width",  pl2.newNumber(result.environment.width)],
			["screen_height", pl2.newNumber(result.environment.height)],
		]);

		if (idx === 0) {
			const t0                          = performance.now();
			ctx.cellResults[idx].iter         = pl2.interpretCode(cell.code, environment);
			ctx.cellResults[idx].evaluateTime = performance.now() - t0;
		} else {
			// Preserve vars from previous cell.

			const parser     = newParser(cell.code);
			const program    = ast.parseProgram(parser);
			const prevResult = ctx.cellResults[idx - 1];

			const result = pl2.newProgramIterator(program, environment);
			for (const [k, v] of prevResult.iter.scopes[0].vars) {
				pl2.setOrCreateVar(result, k, v);
			}

			const t0                          = performance.now();
			ctx.cellResults[idx].iter         = result;
			pl2.interpretProgram(program, result)
			ctx.cellResults[idx].evaluateTime = performance.now() - t0;
		}
	}
}

type CodeCellState = {
	code:        string;
	codeVersion: number;
};

function newCodeCellState(): CodeCellState {
	return {
		code: "",
		codeVersion: 0,
	};
}

function imCodeCell(c: ImCache, state: CodeCellState, output: CodeCellOutput): CodeCellState {
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
			imCodeOutput(c, output);
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

function imCodeOutput(c: ImCache, output: CodeCellOutput) {
	// We'll need this to know the sizes of UI elements before we've ever drawn them.
	// Alternatively, we can just interpret the program once, figure out which UI elements it needs, get the 
	// sizes from the DOM, and re-interpret the programs. I have decided to avoid this route for performance reasons.
	const columnWidth = imdom.getElement(c).clientWidth;
	if (im.Memo(c, columnWidth)) {
		output.environment.width  = columnWidth * window.devicePixelRatio;
		output.environment.height = columnWidth * window.devicePixelRatio / getDesiredAspectRatio();
	}

	const interpretResult = output.iter;
	const code            = output.iter.program.code;

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

		imCodeBegin(c); {
			im.For(c); 
			if (interpretResult.printOutputs.length > 0) {
				for (const p of interpretResult.printOutputs) {
					imStr(c, p);
				} 
			} else {
				imStr(c, "No output");
			}
			im.ForEnd(c);
		} imCodeEnd(c);

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

		if (im.If(c) && interpretResult.drawCalls.length > 0) {
			imVDivider(c);
			
			imSubHeading(c, "Drawing");
			imDrawCalls(c, output);
			imStr(c, "Rendered in "); imStr(c, Math.round(output.canvasDrawTime)); imStr(c, "ms");
		} im.IfEnd(c);

		if (im.If(c) && interpretResult.dataOutputs.length > 0) {
			im.For(c); for (const output of interpretResult.dataOutputs) {
				imSubHeading(c, output.title);

				im.Switch(c, output.type); switch(output.type) {
					case pl2.DataVisualiserType_Table: {
						// A table is great way to visualise data when we have no clue how to visualise the data
						imTable(c, output);
					} break;
					case pl2.DataVisualiserType_Point: {
						imPlot(c, output);
					} break;
					case pl2.DataVisualiserType_Line: {
						imPlot(c, output);
					} break;
					case pl2.DataVisualiserType_Histogram: {
						imStr(c, "TODO: implement histograms");
					} break;
					default: assertNever(output.type);
				} im.SwitchEnd(c);
			} im.ForEnd(c);
		} im.IfEnd(c);
	} im.IfEnd(c);
}

function imTable(c: ImCache, output: DataOutput) {
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
}

function initializeC2d(s: c2d.State) {
	c2d.setColor(s, 1, 1, 1, 1);
	c2d.drawBackground(s);
	c2d.setFont(s, "Inter", 20);
	c2d.setColor(s, 0, 0, 0, 1);
}

function imDrawCalls(c: ImCache, output: CodeCellOutput) {
	const drawCalls = output.iter.drawCalls;

	const s = imC2dBegin(c, getDesiredAspectRatio());
	if (s) {
		if (im.Memo(c, drawCalls)) {
			const t0 = performance.now();

			initializeC2d(s);

			for (let i = 0; i < drawCalls.length; i++) {
				const call = drawCalls[i];

				switch (call.type) {
					case pl2.DrawCall_Line: {
						c2d.drawLine(s, call.p0[0], call.p0[1], call.p1[0], call.p1[1], call.thickness);
					} break;
					case pl2.DrawCall_Circle: {
						c2d.drawCircle(s, call.p0[0], call.p0[1], call.radius);
					} break;
					case pl2.DrawCall_Square: {
						c2d.drawSquare(s, call.p0[0], call.p0[1], call.radius);
					} break;
					case pl2.DrawCall_Rectangle: {
						c2d.drawRect(s, call.p0[0], call.p0[1], call.p1[0], call.p1[1]);
					} break;
					case pl2.DrawCall_Background: {
						c2d.drawBackground(s);
					} break;
					case pl2.DrawCall_Label: {
						c2d.setFont(s, s.fontName, call.size);
						c2d.drawLabelRotated(
							s,
							call.p0[0], call.p0[1],
							call.text,
							call.direction[0], call.direction[1],
							s.fontSizePx / 5,
							call.rotation,
						);
					} break;
				}
			}

			output.canvasDrawTime = performance.now() - t0;
		}
	} imC2dEnd(c, s);
}

function getDesiredAspectRatio(): number {
	return window.innerWidth / window.innerHeight;
}

const PlotType_Point = 0;
const PlotType_Line  = 1;

type PlotType = 
 | typeof PlotType_Point
 | typeof PlotType_Line
 ;

type AxisSelectorEvent = { newAxis: number };

function imAxisSelector(c: ImCache, axes: pl2.DataOutputAxis[], currentAxis: number): AxisSelectorEvent | undefined {
	let result: AxisSelectorEvent | undefined;

	imBegin(c, ROW); {
		im.For(c); for (let i = 0; i < axes.length; i++) {
			if (i > 0) imHSpaceSmall(c);

			const axis = axes[i];
			if (imButtonPressed(c, axis.name, currentAxis === i)) {
				result = { newAxis: i };
			}
		} im.ForEnd(c);
	} imEnd(c);

	return result;
}

function imPlot(c: ImCache, output: pl2.DataOutput) {
	const axes = output.axes;

	const plotState = im.State(c, plt.newPlotState);
	const state = im.GetInline(c, imPlot) ?? im.Set(c, { xAxis: 0, yAxis: 0 });

	imBegin(c, ROW, CENTER); {
		imStr(c, "X: ");
		imHSpaceSmall(c);
		const xAxisSelect = imAxisSelector(c, output.axes, state.xAxis);
		if (xAxisSelect) {
			state.xAxis = xAxisSelect.newAxis;
		}

		imHSpace(c);

		imStr(c, "Y: ");
		imHSpaceSmall(c);
		const yAxisSelect = imAxisSelector(c, output.axes, state.yAxis);
		if (yAxisSelect) {
			state.yAxis = yAxisSelect.newAxis;
		}
	} imEnd(c);

	const dragState = im.GetInline(c, imPlot) ?? im.Set(c, {
		dragging: false,
		x: 0, y: 0, xLo: 0, xHi: 0, yLo: 0, yHi: 0,
		version: 0
	});

	const s = imC2dBegin(c, getDesiredAspectRatio());
	if (s) {
		if (im.isFirstishRender(c)) {
			imdom.setStyle(c, "cursor", "move");
		}

		const outputChanged = im.Memo(c, output);
		const xAxisChanged  = im.Memo(c, state.xAxis);
		const yAxisChanged  = im.Memo(c, state.yAxis);
		const dragChanged   = im.Memo(c, dragState.version);
		const plotChanged   = im.Memo(c, plotState.version);

		if (axes.length === 1) {
			state.xAxis = 0;
			state.yAxis = 0;
		}
		const xAxis = axes[state.xAxis];
		const yAxis = axes[state.yAxis];

		if (outputChanged) {
			initializeC2d(s);
			plt.refitPlot(plotState, xAxis.numbers, yAxis.numbers);
		}

		if (outputChanged || xAxisChanged || yAxisChanged || dragChanged || plotChanged) {
			initializeC2d(s);
			plotState.lines = output.type === pl2.DataVisualiserType_Line;

			c2d.setColor(s, 1, 1, 1, 1);
			c2d.drawBackground(s)
			c2d.setColor(s, 0, 0, 0, 1);

			plt.plotAxes(s, plotState, xAxis.name, yAxis.name);
			plt.plotPoints(s, plotState, xAxis.numbers, yAxis.numbers);
		}

		const mouse = imdom.getMouse();

		if (imdom.hasMousePress(c)) {
			dragState.dragging = true;
			dragState.x = mouse.X;
			dragState.y = mouse.Y;
			dragState.xLo = plotState.x.lo;
			dragState.xHi = plotState.x.hi;
			dragState.yLo = plotState.y.lo;
			dragState.yHi = plotState.y.hi;
			dragState.version += 1;
		}

		if (dragState.dragging) {
			plotState.x.lo = dragState.xLo; plotState.x.hi = dragState.xHi;
			plotState.y.lo = dragState.yLo; plotState.y.hi = dragState.yHi;

			const dx = -(plt.mapScreenXToXAxis(s, plotState, mouse.X) - plt.mapScreenXToXAxis(s, plotState, dragState.x));
			const dy = plt.mapScreenYToYAxis(s, plotState, mouse.Y) - plt.mapScreenYToYAxis(s, plotState, dragState.y);

			plotState.x.lo = dragState.xLo + dx; plotState.x.hi = dragState.xHi + dx;
			plotState.y.lo = dragState.yLo + dy; plotState.y.hi = dragState.yHi + dy;

			plotState.version += 1;
		}
		
		if (dragState.dragging && !mouse.leftMouseButton) {
			dragState.dragging = false;
			dragState.version += 1;
		}
	} imC2dEnd(c, s);
}

