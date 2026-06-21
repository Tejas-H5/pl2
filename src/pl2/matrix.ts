export type Matrix = {
	data: number[];
	rows: number;
	cols:  number;
}

export function matrixValuesToString(mat: Matrix): string {
	let sb: string[] = [];

	for (let row = 0; row < mat.rows; row++) {
		sb.push("\n    [");
		for (let col = 0; col < mat.cols; col++) {
			if (col !== 0) sb.push(", ");

			const idx = matrixGetIndex(mat, row, col);
			sb.push("" + mat.data[idx]);
		}
		sb.push("],");
	}

	return sb.join("");
}


export function matrixGetIndex(mat: Matrix, row: number, col: number): number {
	return row * mat.cols + col;
}

export function matrixSetAxis(mat: Matrix, vec: number[], col: number) {
	for (let i = 0; i < vec.length; i++) {
		const idx = matrixGetIndex(mat, i, col);
		mat.data[idx] = vec[i];
	}
}

export function cloneMatrix(mat: Matrix): Matrix {
	return {
		rows: mat.rows,
		cols: mat.cols,
		data: mat.data.map(x => x),
	};
}

