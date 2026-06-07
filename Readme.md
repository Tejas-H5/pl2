# Programming Language 2

This is my 3rd (and final) attempt at creating a programming language in TypeScript.
The aim is for the language to be:

- Pleasant to use
- Not tightly couple us to JavaScript
- Solve specific probelms instead of generic ones, similar to Odin philosophy in a sense

The main reason is because the last programming language I made, alongside a custom text editor, and debugger, end output viewer, were all
extremely difficult to reuse or move into another project where I wanted to use it. So with this one, I want to especially focus on nailing the API
design and reuse aspects of the code. 

Still not using AI ...

## High level overview

```
Let's think about what I want the language to do:

- Basic maths.
    + - * / // ^
    also, (operator)= should be equivelant to a = a + blah
- List manipulation. 
    get[index], set[index], shift, unshift, push, pop, insert, remove, undordered_remove
- Maps
    val, ok = get[key], set[key]
- Matrices and rotations
    + - * [dot] [x] 
- 2D graphics, vectors
    draw lines
- 2D arrays, 3D arrays. images, heatmaps
- Audio playback experimentation
- Data analsysis maybe? JSON stuff? CSV stuff?
- Physics simulations, game input

It is helpful if the language has similar constructs to existing languages. like JavaScript or Odin.

- functions
- if-statements
- for-loops
- begin/end pairs (tree building) (other languages dont even have this xdd) kinda useless for toher things ngl. 

Another thing to thing about is to structure the language in such a way that the LSP can always provide useful autocompletions.
a.blah is better than blah(a). think about it. 

omg = fn[T](a: int, b: map[string, map[string, T]]): int {
    for i in 0..<10 {
        print(i, " ", i2)
    }
}

map = map[string, number]{x, y, z}

Let's make everything immutable by default. Just because I don't like the :: syntax. 
I never liked how in odin we can do x : f32 = 0 and x := f32(0), so I want the type to always be on the right. 
Even push-based iterators would be sick:

iter = iterator(a: int): int, int {
    // odin does not have decending range loops like this, nor does #reverse work with them, so doing a..<=b fixes this semantic.
    for i in a..>=0 { 
        yield x
    }
}

I stole this one from GingerBill as well :D Wish odin had it. 
Can be a stretch goal.
```
