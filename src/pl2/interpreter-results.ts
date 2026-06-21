// This file exists to remove the circular dependency bugs between interpreter.ts and builtins.ts

import * as ast from "./ast";
import { assert, assertNever } from "./assert";
import { getBuiltin } from "./builtins";
import { setError } from "./interpreter";
import { Matrix, cloneMatrix } from "./matrix";

