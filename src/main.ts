import { el, im, ImCache, imdom } from "./im-js";
import { runAllTests } from "./testing/testing";
import "./pl2";

const results = runAllTests();

function imMain(c: ImCache) {
	im.CacheBegin(c, imMain); {
		imdom.RootBegin(c, document.body); {
			if (im.isFirstishRender(c)) {
				imdom.setStyle(c, "fontFamily", "arial")
			}

			const ev = imdom.GlobalEventSystemBegin(c); {
				im.For(c); for (const test of results.tests) {
					const failed = !!test.fails || test.checks === 0;

					imdom.ElBegin(c, el.DIV); {
						imdom.ElBegin(c, el.B); {
							if (im.Memo(c, failed)) {
								imdom.setStyle(c, "color", failed ? "#F00" : "#000");
							}

							if (im.If(c) && failed) {
								imdom.Str(c, "FAIL");
							} else {
								im.IfElse(c);
								imdom.Str(c, "PASS ("); imdom.Str(c, test.checks); imdom.Str(c, ")");
							} im.IfEnd(c);
							imdom.Str(c, " - "); imdom.Str(c, test.name);
						} imdom.ElEnd(c, el.B);
					} imdom.ElEnd(c, el.DIV)
					imdom.ElBegin(c, el.DIV); {
						if (im.If(c) && test.fails) {
							im.For(c); for (const err of test.fails) {
								imdom.ElBegin(c, el.DIV); {
									imdom.Str(c, err);
								} imdom.ElEnd(c, el.DIV)
							}; im.ForEnd(c);
						} else if (im.IfElse(c) && test.checks === 0) {
							imdom.Str(c, "This test didn't test anything");
						} im.IfEnd(c);
					} imdom.ElEnd(c, el.DIV)
				} im.ForEnd(c);
			} imdom.GlobalEventSystemEnd(c, ev);
		} imdom.RootEnd(c, document.body);
	} im.CacheEnd(c);
}

const c: ImCache = []
imMain(c);



