# Conventions

I've documented all the unusal patterns the codebase uses here, for future reference.
I don't use AI on personal projects yet, but when I do, it will become useful.

## Programming

- The final output must be a single HTML file that can be downloaded and ran offline. 
    - Assets, like images, fonts, styles, small audio effects, and worker scripts must all be embedded into the page rather than linked to.
- Only functions and data. Don't be too fancy. Prefer non-capturing closures where possible. Just don't use a `class` ever.
    - Code becomes more consistent, easier to reason about, and we avoid circular dependency problem you get with dependency injection patterns.
    - Plain objects are far easier to consistently serialize and de-serialize than classes
- Prefer for-loops over functional programming
    - Fewer memory allocations, so it ends up being MUCH more performant
    - Code is more malleable and flexible as requirements change
    - Refactoring candidates become far more obvious, and as such, this allows us to factor out code into a series of reuseable parts, which actually allows us to end up with _fewer_ LOC overall
- Tests should be specified in the same file as the things they are testing, and should state which functions they are trying to cover in parenthesis. 
    - NOTE: the bundle will now include tests, unless we're clever about it.
        - Since we don't use React, or any libraries in general, we have plenty of 'budget' to spare in the bundle, so I don't care too much for now.
- Try to avoid royal we
    - What do we mean by we? I meant me. Typing 'we' instead is just a bad habbit, not a convention

- Avoid long lists of imports. If a file imports hundreds of things from another file, then they probably shouldn't have been split into two files in the first place.
    - Use headings to make the single massive file easier to navigate
////////////////////////////////////////////////////
// Heading
    - Use namespace imports to expose modules with a large number of types and functions

## Tests

- Use the bespoke test framework
- All tests must be against the highest level of abstraction possible. Test `parseExpression` instead of testing `parseNumberLiteral` directly, for example.
- All tests must complete in less than 1 second, considering the relative simplicity of this project.
- Add new tests for every bug we are fixing

## Dependencies

I'm using a different approach to dependencies than from my previous projects.
It's more complicated, but hopefully it pays off. 

- All peer-dependencies must be imported with absolute paths.
- All self-contained dependencies must import their files with relative imports, such that I can copy-paste their folder
    to another project with 0 changes. 
    - Peer-deps must be imported with absolute paths, so that I can simply copy-paste the peer dependencies
- npm-install should only be used for dev-dependencies or complicated code we don't care to write
    - dev tools, bundlers, linters, transpilers are here
    - fast fourier transform, matrix math, crypto algorithms, indexeddb wrappers
        - except I am one of these people that does want to code these myself so I am ignoring this advice knowingly
