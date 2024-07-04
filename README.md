<h3 align="center">⚡ Fast Olympic Coding ⚡</h3>

![Testcases Gif](media/demo.gif)

<p align="center">
<img src="https://vsmarketplacebadges.dev/version-short/sam20908.vscode-fastolympiccoding.svg">
<img src="https://vsmarketplacebadges.dev/installs-short/sam20908.vscode-fastolympiccoding.svg">
<img src="https://vsmarketplacebadges.dev/rating-short/sam20908.vscode-fastolympiccoding.svg">
</p>

> [!IMPORTANT]
> Versions under 1.x saved data formats are NOT stable. Therefore, users should clear their saved data when updating
> 
> Do it by using command pallete (`Ctrl+P`) and enter **`Fast Olympic Coding: Clear Saved Data`**

Fast Olympic Coding is an extension to assist with various tasks in competitive programming. It is a ported and enhanced version of the corresponding Sublime Text plugin that also leverages the power of VSCode.

### ⚡ Overview
  - Concurrently run, edit, and delete multiple testcases
  - Stress tester to find counterexamples
  - Insert pre-written code in another file without switching tabs!
  - ***BLAZINGLY FAST!*** Asynchronous design + optimizations = **99%** spam proof!

### 💻 Keybinds
- Compile (if file has compile command and file had changed) and run all testcases: `Ctrl+Alt+B`
- Run stress test: `Ctrl+Alt+G`
- Delete all testcases: `Ctrl+Alt+D`
- Insert file template: `Ctrl+Alt+I`
  - Control if the content should be folded via settings.

### ✅ Interested? _[INSTALL](#how-to-install) AND [SET IT UP](#setting-up) RIGHT NOW!_

---

### 📝 Todo
- Integration with [Competitive Companion](https://github.com/jmerle/competitive-companion)
  - Problem parser (and maybe contest parser)
- "Emmet" for class types (`Class Completion` functionality in original plugin)



---

### </> Setting Up
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

### 📜 Testcase Window
- Accept outputs to detect wrong answers later!

![AC Gif](media/ac.gif)

- Compilation errors will be displayed in a popup window.

![Compile Error Gif](media/compile_error.gif)

- Very long outputs will be truncated. 

![Truncated Messages Gif](media/truncated_messages.gif)

---

### 👨🏻‍💻 Stress Tester
- Rapidly runs the current solution, the correct solution, and the input generator to find potential counterexamples.
- The generator is provided with a random seed to generate the input

*Gif is recorded at 10FPS but the tester runs as low as 5ms between testcases!*

![Stress Tester Gif](media/stress_tester.gif)

---

### 👜 Other Goodies
- Insert code from a pre-written library and automatically folded by VSCode!

![File Template Gif](media/file_template.gif)

---

### 📥 How to Install
- VSCode Marketplace: [Fast Olympic Coding](https://marketplace.visualstudio.com/items?itemName=sam20908.vscode-fastolympiccoding)
- Command in Quick Open (`Ctrl+P`): `ext install sam20908.vscode-fastolympiccoding`

---

### © Attributions

- [FastOlympicCoding](https://github.com/Jatana/FastOlympicCoding): The original Sublime Text package that inspired this extension 💖
- [Flaticon](https://www.flaticon.com/): Icon for this extension 💖
