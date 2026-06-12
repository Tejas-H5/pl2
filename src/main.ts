import { im, ImCache, imdom } from "./im-js";
import "./pl2";


function imApp(c: ImCache) {
	if (im.isFirstishRender(c)) {
		imdom.setStyle(c, "fontFamily", "arial")
	}
}

function imMain(c: ImCache) {
	im.CacheBegin(c, imMain); {
		imdom.RootBegin(c, document.body); {
			const ev = imdom.GlobalEventSystemBegin(c); {
				imApp(c);
			} imdom.GlobalEventSystemEnd(c, ev);
		} imdom.RootEnd(c, document.body);
	} im.CacheEnd(c);
}

const c: ImCache = []
imMain(c);



