export type DeepEqualsResult = {
    currentPath: string[];
    mismatches: DeepEqualsMismatch[];
    numMatches: number;
};

export type DeepEqualsMismatch = {
    path:     string;
    expected: unknown;
    got:      unknown;
};

export type DeepEqualsOptions = {
    failFast?: boolean;
    floatingPointTolerance?: number;
};

export function deepEquals<T>(
    a: T,
    b: T,
    opts: DeepEqualsOptions = {},
): DeepEqualsResult {
    const result: DeepEqualsResult = { currentPath: [], mismatches: [], numMatches: 0 };

    deepEqualsInternal(result, a, b, opts, "root");

    return result;
}

function pushDeepEqualsMismatch(
    result: DeepEqualsResult,
    expected: unknown,
    got: unknown,
) {
    const path = result.currentPath.join("");
    result.mismatches.push({ path, expected, got });
}

// TODO: print all the inequalitieis
function deepEqualsInternal<T>(
    result: DeepEqualsResult,
    a: T,
    b: T,
    opts: DeepEqualsOptions,
    pathKey: string,
): boolean {
    let primitiveMatched = false;
    if (a === b) {
        primitiveMatched = true;
    } else if (typeof a === "number" && typeof b === "number") {
        if (isNaN(a) && isNaN(b)) {
            primitiveMatched = true;
        } else {
            const tolerance = opts.floatingPointTolerance ?? 0;
            if (Math.abs(a - b) < tolerance) {
                primitiveMatched = true;
            }
        }
    }

    if (primitiveMatched) {
        result.numMatches++;
        return true;
    }

    result.currentPath.push(pathKey);

    if (
        (typeof a !== "object" || typeof b !== "object") ||
        (a === null || b === null)
    ) {
        // Strict-equals would have worked if these were the case.
        pushDeepEqualsMismatch(result, a, b);
        result.currentPath.pop();
        return false;
    }

    let popPath = false;
    let matched = true;

    if (Array.isArray(a)) {
        matched = false;
        if (Array.isArray(b)) {
            matched = true;
            for (let i = 0; i < a.length; i++) {
                if (!deepEqualsInternal(result, a[i], b[i], opts, "[" + i + "]")) {
                    matched = false;
                    if (opts.failFast) break;
                }
            }
        }
    } else if (a instanceof Set) {
        matched = false;
        if (b instanceof Set && b.size === a.size) {
            matched = true;
            for (const val of a) {
                if (!b.has(val)) {
                    matched = false;
                    break;
                }
            }
        }
    } else if (a instanceof Map) {
        matched = false;
        if (b instanceof Map && a.size === b.size) {
            matched = true;

            for (const [k, aVal] of a) {
                if (b.has(k)) {
                    const bVal = b.get(k);
                    if (!deepEqualsInternal(result, aVal, bVal, opts, ".get(" + k + ")")) {
                        matched = false;
                        if (opts.failFast) break;
                    }
                }
            }
        }
    } else {
        // a is just an object
        for (const k in a) {
            if (!(k in b)) {
                matched = false;
                if (opts.failFast) break;
            }

            if (!deepEqualsInternal(result, a[k], b[k], opts, "." + k)) {
                matched = false;
                if (opts.failFast) break;
            }
        }
    }

    result.currentPath.pop();
    return matched;
}

export function deepCompareArraysAnyOrder<T>(a: T[], b: T[]) {
    for (let i = 0; i < b.length; i++) {
        let anyEqual = false;
        for (let j = 0; j < b.length; j++) {
            if (deepEquals(a[i], b[j])) {
                anyEqual = true;
                break;
            }
        }
        if (!anyEqual) return false;
    }
    return true;
}
