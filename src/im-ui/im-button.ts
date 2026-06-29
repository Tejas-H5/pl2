import { el, im, ImCache, imdom } from "/im-js";
import { cssVars, DisplayType, imui } from "/im-ui";

const cssb = imui.newCssBuilder("button");

const cnToggled = cssb.newClassName("toggled");
const cnButton  = cssb.cn("button", [
` {
    all: unset; 
    border:        2px solid ${cssVars.fg};
    padding:       0px 10px;
    border-radius: 5px;
    user-select:   none;
    cursor:        pointer;
    background-color: ${cssVars.bg};
    color: ${cssVars.fg};
}`,
    `:hover { background-color: ${cssVars.bg2} }`,

    `.${cnToggled} { background-color: ${cssVars.fg}; color: ${cssVars.bg}; }`,
    `.${cnToggled}:hover { background-color: ${cssVars.fg2} }`,

    `:active { transform: translate(2px, 1px); }`,
]);

export function imButtonBegin(c: ImCache, toggled: boolean = false) {
	imdom.ElBegin(c, el.BUTTON); {
        if (im.isFirstishRender(c)) imdom.setClass(c, cnButton);
        if (im.Memo(c, toggled)) imdom.setClass(c, cnToggled, toggled);
    } // imdom.ElEnd
}

export function imButtonEnd(c: ImCache) {
	imdom.ElEnd(c, el.BUTTON);
}

export function imButtonPressed(c: ImCache, text: string, toggled = false): boolean {
    let result = false;

    imButtonBegin(c, toggled); {
        imdom.Str(c, text);
        result = imdom.hasMousePress(c);
    } imButtonEnd(c);

    return result;
}
