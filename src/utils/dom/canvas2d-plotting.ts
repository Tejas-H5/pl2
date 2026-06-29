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
}

export type PlotState = {
	x: AxisSettings;
	y: AxisSettings;
	lines: boolean;
	version: number;
}

export function newPlotState(): PlotState {
	return {
		x: { lo: 0, hi: 1 },
		y: { lo: 0, hi: 1 },
		lines: false,
		version: 0,
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

export function plotAxes(s: c2d.State, options: PlotState, xAxisName: string, yAxisName: string) {
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
		const tickGap  = getAxisTickSize(options.x);
		const xStart   = getAxisTickStart(options.x, tickGap);
		for (let x = xStart; x < options.x.hi; x += tickGap) {
			const xTick = mapXAxisToScreenX(s, options, x);
			c2d.drawLine(s, xTick, yLine, xTick, yLine - tickSize, thickness);
		}
	}

	// Y axis
	{
		const xLine = getAxisOffsetFromEdge(s);
		c2d.drawLine(s, xLine, 0, xLine, s.height, thickness);

		const tickSize = 5;
		const tickGap  = getAxisTickSize(options.y);
		const yStart   = getAxisTickStart(options.y, tickGap);
		for (let y = yStart; y < options.y.hi; y += tickGap) {
			const yTick = mapYAxisToScreenY(s, options, y);
			c2d.drawLine(s, xLine, yTick, xLine + tickSize, yTick, thickness);
		}
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
