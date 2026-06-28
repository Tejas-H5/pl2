import { imdom, el } from "im-js";
import { im, ImCache } from "im-js/im-core";
import * as c2d from "dom-utils/canvas2d";

export function imC2dBegin(c: ImCache, aspectRatio: number): c2d.State | undefined { 
	let canvasState: c2d.State | undefined;

	const canvasRoot = imdom.ElBegin(c, el.CANVAS); {
		canvasState = 
			im.Get(c, c2d.createContext) ??
			im.Set(c, c2d.createContext(canvasRoot.root));

		if (im.If(c) && canvasState) {
			const clientWidth = canvasRoot.root.clientWidth;
			if (im.Memo(c, clientWidth)) {
				c2d.applyAspectRatioToHeight(canvasState, aspectRatio);
			}

			c2d.beginFrame(canvasState);
		} //  im.IfEnd
	} // imdom.ElEnd

	return canvasState;
}

export function imC2dEnd(c: ImCache, canvasState: c2d.State | undefined) {
	{
		{
			if (canvasState) {
				c2d.endFrame(canvasState);
			}
		} im.IfEnd(c);
	} imdom.ElEnd(c, el.CANVAS);
}
