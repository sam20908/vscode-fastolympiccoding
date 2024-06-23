<h3 align="center">⚡ Fast Olympic Coding ⚡</h3>

![Testcases Gif](media/demo.gif)

Fast Olympic Coding is an extension to assist with various common tasks in competitive programming. It is a ported and enhanced version of the corresponding Sublime Text plugin by integrating various VSCode functionalities.

⚡ What other goodies does this extension offer?
  - Concurrently run, edit, and delete multiple testcases
  - Heavily optimized: avoid any unnecessary re-rendering, batching `stdout` and `stderr` messages, etc...

### Interested? _[INSTALL](#how-to-install) AND [SET IT UP](#setting-up) RIGHT NOW!_

---

### How to Install
- VSCode Marketplace: [Fast Olympic Coding](https://marketplace.visualstudio.com/items?itemName=sam20908.vscode-fastolympiccoding)
- Command in Quick Open (`Ctrl+P`): `ext install sam20908.vscode-fastolympiccoding`

---

### Todo
- Documentation on settings
- Integration with [Competitive Companion](https://github.com/jmerle/competitive-companion)
  - Problem parser (and maybe contest parser)
- Stress tester
- "Emmet" for class types (`Class Completion` functionality in original plugin)
- File snippets (`Auto` function in original plugin)

### Not Planned
- Built-in linter. Please use another extension like [Microsoft's C/C++ Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools).

---

### Setting Up
Provide run settings for the languages you use in `settings.json`. Here are some examples for C++, Python, and Java:
```json
{
  "fastolympiccoding.runSettings": {
    ".cpp": {
      "compileCommand": "g++ -std=gnu++20 -D_GLIBCXX_DEBUG ${file} -o ${fileDirname}/${fileBasenameNoExtension}${exeExtname} -fdiagnostics-color=always",
      "runCommand": "${fileDirname}/${fileBasenameNoExtension}${exeExtname}"
    },
    ".py": {
      "runCommand": "python ${file}"
    },
    ".java": {
      "compileCommand": "javac ${file}",
      "runCommand": "java -cp ${fileDirname} ${fileBasenameNoExtension}"
    }
  }
}
```

- We can use [VSCode's built-in variables](https://code.visualstudio.com/docs/editor/variables-reference) as well as `${exeExtname}` that resolves into `.exe` for Windows and an empty string for other platforms. 
- Forward/backward slashes are automatically normalized when being executed.

---

### Testcase Window
- The extension will load the saved testcases for the opened file, and the testcases will automatically update whenever you switch files.
- Accept outputs to detect wrong answers later!

![AC Gif](media/ac.gif)

- Compilation errors will be displayed in a popup window.

![Compile Error Gif](media/compile_error.gif)

- Very long outputs will be truncated (adjustable character limit at `fastolympiccoding.maxCharactersForOutput`)

![Truncated Messages Gif](media/truncated_messages.gif)

---

### Attributions

- [FastOlympicCoding](https://github.com/Jatana/FastOlympicCoding): The original Sublime Text package that inspired this extension 💖
- [Flaticon](https://www.flaticon.com/): Icon for this extension 💖