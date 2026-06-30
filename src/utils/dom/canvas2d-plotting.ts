import * as c2d from "./canvas2d";

export const POINT = 0;
export const LINE  = 1;

export type Type =
 | typeof POINT
 | typeof LINE
 ;

type AxisSettings = {
	lo: number;
	hi: number;

	fitLo: number;
	fitHi: number;
}

export type PlotState = {
	x: AxisSettings;
	y: AxisSettings;
	lines: boolean;
	version: number;
	dragState: PlotDragState;
}

type PlotDragState = {
	interaction: DragInteractionType;
	x: number; xLo: number; xHi: number;
	y: number; yLo: number; yHi: number;
	version: number;
}

export function newPlotState(): PlotState {
	return {
		x: { lo: 0, hi: 1, fitLo: 0, fitHi: 1 },
		y: { lo: 0, hi: 1, fitLo: 0, fitHi: 1 },
		lines: false,
		version: 0,

		dragState: {
			interaction: NOTHING,
			x: 0, y: 0, xLo: 0, xHi: 0, yLo: 0, yHi: 0,
			version: 0
		}
	};
}

export function refitPlot(plotState: PlotState, xAxis: number[], yAxis: number[]) {
	let xMin = 0; let xMax = 0;
	let yMin = 0; let yMax = 0;

	for (let i = 0; i < xAxis.length; i++) {
		xMin = Math.min(xMin, xAxis[i]);
		xMax = Math.max(xMax, xAxis[i]);
		yMin = Math.min(yMin, yAxis[i]);
		yMax = Math.max(yMax, yAxis[i]);
	}

	plotState.x.lo = xMin; plotState.x.hi = xMax;
	plotState.y.lo = yMin; plotState.y.hi = yMax;

	plotState.x.hi += getTickSizeForDomain(xMax - xMin);
	plotState.y.hi += getTickSizeForDomain(yMax - yMin);

	plotState.x.fitLo = plotState.x.lo; 
	plotState.y.fitLo = plotState.y.lo; 
	plotState.x.fitHi = plotState.x.hi;
	plotState.y.fitHi = plotState.y.hi;
}

function getAxisDomain(axis: AxisSettings): number {
	return Math.abs(axis.hi - axis.lo);
}

function getTickSizeForDomain(domain: number): number {
	// If size is 1, we want to have already switched to a tick size of 0.1.
	// This factor is a consistent way to do something similar for every size.
	// It's kinda arbitrary - I've tuned it by using it
	const tickFactor       = 0.4; 
	const closestPowerOf10 = Math.log10(tickFactor * domain);
	const tickSize         = Math.pow(10, Math.floor(closestPowerOf10));
	return tickSize;
}

function getAxisTickSize(axis: AxisSettings) {
	const yDomain  = getAxisDomain(axis);
	const tickSize = getTickSizeForDomain(yDomain);
	return tickSize;
}

function getAxisTickStart(axis: AxisSettings, tickSize: number): number {
	return Math.floor(axis.lo / tickSize) * tickSize;
}

function getAxisOffsetFromEdge(s: c2d.State) {
	const gap = 4;
	return s.fontSizePx + gap;
}

export function plotAxes(s: c2d.State, plot: PlotState, xAxisName: string, yAxisName: string) {
	const xCenter = s.width  / 2;
	const yCenter = s.height / 2;

	c2d.drawLabel(s, xCenter, s.height, xAxisName, 0, -1, 0);
	c2d.drawLabelRotated(s, 0, yCenter, yAxisName, 0, 1, 0, -Math.PI / 2);

	const thickness = 1;

	// X axis
	{
		const yLine = s.height - getAxisOffsetFromEdge(s);
		c2d.drawLine(s, 0, yLine, s.width, yLine, 1);

		const tickSize = 5;
		const tickGap  = getAxisTickSize(plot.x);
		const xStart   = getAxisTickStart(plot.x, tickGap);
		for (let x = xStart; x < plot.x.hi; x += tickGap) {
			const xTick = mapXAxisToScreenX(s, plot, x);
			c2d.drawLine(s, xTick, yLine, xTick, yLine - tickSize, thickness);
		}
	}

	// Y axis
	{
		const xLine = getAxisOffsetFromEdge(s);
		c2d.drawLine(s, xLine, 0, xLine, s.height, thickness);

		const tickSize = 5;
		const tickGap  = getAxisTickSize(plot.y);
		const yStart   = getAxisTickStart(plot.y, tickGap);
		for (let y = yStart; y < plot.y.hi; y += tickGap) {
			const yTick = mapYAxisToScreenY(s, plot, y);
			c2d.drawLine(s, xLine, yTick, xLine + tickSize, yTick, thickness);
		}
	}
}

export function isOverBottomAxis(s: c2d.State, mouseY: number): boolean {
	const top  = s.canvas.getBoundingClientRect().top;
	mouseY     = -(mouseY - top - s.canvas.clientHeight);
	const size = getAxisOffsetFromEdge(s);
	return 0 < mouseY && mouseY < size;
}

export function isOverLeftAxis(s: c2d.State, mouseX: number): boolean {
	mouseX -= s.canvas.getBoundingClientRect().left;
	const size = getAxisOffsetFromEdge(s);
	return 0 < mouseX && mouseX < size;
}

export const NOTHING  = 0;
export const DRAGGING = 1;
export const ZOOMING  = 2;

export type DragInteractionType = 
 | typeof NOTHING
 | typeof DRAGGING
 | typeof ZOOMING
 ;

export function handleDragInteraction(
	s: c2d.State,
	plot: PlotState,
	startingInteraction: boolean,
	interaction: DragInteractionType,
	mouseX: number, mouseY: number, 
) {
	const dragState = plot.dragState;

	if (startingInteraction) {
		dragState.interaction = interaction;
		dragState.x = mouseX;
		dragState.y = mouseY;
		dragState.xLo = plot.x.lo;
		dragState.xHi = plot.x.hi;
		dragState.yLo = plot.y.lo;
		dragState.yHi = plot.y.hi;
		dragState.version += 1;
	}

	if (dragState.interaction !== NOTHING) {
		plot.x.lo = dragState.xLo; plot.x.hi = dragState.xHi;
		plot.y.lo = dragState.yLo; plot.y.hi = dragState.yHi;

		const dx = -(mapScreenXToXAxis(s, plot, mouseX) - mapScreenXToXAxis(s, plot, dragState.x));
		const dy =   mapScreenYToYAxis(s, plot, mouseY) - mapScreenYToYAxis(s, plot, dragState.y);

		if (dragState.interaction === DRAGGING) {
			plot.x.lo = dragState.xLo + dx; plot.x.hi = dragState.xHi + dx;
			plot.y.lo = dragState.yLo + dy; plot.y.hi = dragState.yHi + dy;
		} else if (dragState.interaction === ZOOMING) {
			plot.x.lo = dragState.xLo - dx; plot.x.hi = dragState.xHi + dx;
			plot.y.lo = dragState.yLo - dy; plot.y.hi = dragState.yHi + dy;
		}

		fixPlotDomain(plot);

		plot.version += 1;
	}

	if (dragState.interaction !== interaction && interaction === NOTHING) {
		dragState.interaction = NOTHING;
		dragState.version += 1;
	}
}

export function mapYAxisToScreenY(s: c2d.State, options: PlotState, val: number) {
	return s.height - mapValueToScreen(s, options.y, val, s.height);
}

export function mapScreenYToYAxis(s: c2d.State, options: PlotState, val: number) {
	return mapScreenToValue(s, options.y, val - s.height, s.height);
}

export function mapXAxisToScreenX(s: c2d.State, options: PlotState, val: number) {
	return mapValueToScreen(s, options.x, val, s.width);
}

export function mapScreenXToXAxis(s: c2d.State, options: PlotState, val: number) {
	return mapScreenToValue(s, options.x, val, s.width);
}

export function plotPoints(s: c2d.State, options: PlotState, xAxis: number[], yAxis: number[]) {
	let numDataPoints = Math.max(xAxis.length, yAxis.length);

	let xPrev = 0, yPrev = 0;

	for (let i = 0; i < numDataPoints; i++) {
		const x = mapXAxisToScreenX(s, options, xAxis[i]);
		const y = mapYAxisToScreenY(s, options, yAxis[i]);

		if (options.lines) {
			if (i > 0) {
				c2d.drawLine(s, xPrev, yPrev, x, y, 2);
			}
		} 

		c2d.drawCircle(s, x, y, 4);

		xPrev = x;
		yPrev = y;
	}
}

export function mapValueToScreen(s: c2d.State, axisSettings: AxisSettings, val: number, screenSize: number): number {
	const offset   = getAxisOffsetFromEdge(s);
	const realSize = screenSize - offset;
	let t = (val - axisSettings.lo) / (axisSettings.hi - axisSettings.lo);
	return offset + t * realSize;
}

export function mapScreenToValue(s: c2d.State, axisSettings: AxisSettings, val: number, screenSize: number): number {
	const offset   = getAxisOffsetFromEdge(s);
	const realSize = screenSize - offset;
	const t = val / realSize;
	return t * (axisSettings.hi - axisSettings.lo) + axisSettings.lo;
}

export function fixPlotDomain(plot: PlotState) {
	fixPlotAxis(plot.x);
	fixPlotAxis(plot.y);
}

export function fixPlotAxis(axis: AxisSettings) {
	const size = axis.fitHi - axis.fitLo;
	const minSize = 0.1 * size;
	const maxSize = 10  * size;

	const axisSize = axis.hi - axis.lo;
	if (axisSize < minSize) {
		let mid = 0.5 * axis.hi + 0.5 * axis.lo;
		axis.lo = mid - minSize / 2;
		axis.hi = mid + minSize / 2;
	} else if (axisSize > maxSize) {
		let mid = 0.5 * axis.hi + 0.5 * axis.lo;
		axis.lo = mid - maxSize / 2;
		axis.hi = mid + maxSize / 2;
	}
}

