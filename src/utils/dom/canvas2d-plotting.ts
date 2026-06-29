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
}


export function plotAxes(s: c2d.State, options: PlotState, xAxisName: string, yAxisName: string) {
	const xCenter = s.width  / 2;
	const yCenter = s.height / 2;

	c2d.drawLabel(s, xCenter, s.height, xAxisName, 0, -1, 10);
	c2d.drawLabelRotated(s, 0, yCenter, "dasdsad", 0, 1, 10, Math.PI / 2);
}

export function plotPoints(s: c2d.State, options: PlotState, xAxis: number[], yAxis: number[]) {
	let numDataPoints = Math.max(xAxis.length, yAxis.length);

	for (let i = 0; i < numDataPoints; i++) {
		const x = remapValue(xAxis[i], options.x, s.width);
		const y = s.height - remapValue(yAxis[i], options.y, s.height);

		if (options.lines) {
			if (i > 0) {
				const xPrev = xAxis[i - 1];
				const yPrev = yAxis[i - 1];
				c2d.drawLine(s, xPrev, yPrev, x, y, 2);
			}
		} 

		c2d.drawCircle(s, x, y, 4);
	}
}

export function remapValue(val: number, axisSettings: AxisSettings, axisSize: number): number {
	let t = (val - axisSettings.lo) / (axisSettings.hi - axisSettings.lo);
	return t * axisSize;
}
