<h3 align="center">⚡ Fast Olympic Coding ⚡</h3>

![Testcases Gif](media/demo.gif)

<p align="center">
<img src="https://vsmarketplacebadges.dev/version-short/sam20908.vscode-fastolympiccoding.svg">
<img src="https://vsmarketplacebadges.dev/installs-short/sam20908.vscode-fastolympiccoding.svg">
<img src="https://vsmarketplacebadges.dev/rating-short/sam20908.vscode-fastolympiccoding.svg">
</p>

> [!IMPORTANT]
> Saved data format is _NOT_ finalized. Therefore, users should clear their saved data when updating
> 
> Do it by using command pallete (`Ctrl+P`) and enter **`Fast Olympic Coding: Clear Saved Data`**

Fast Olympic Coding is an extension to assist with various tasks in competitive programming. It is a ported and enhanced version of the corresponding Sublime Text plugin that also leverages the power of VSCode.

### ⚡ Overview

  - [📜](#-testcase-window) Concurrently run, edit, and delete multiple testcases
  - [👨🏻‍💻](#-stress-tester) Stress tester to find counterexamples
  - [👜](#-inserting-prewritten-code) Insert pre-written code from another file with automatic folding
  - [🛜](#-competitive-companion) Reads testcases and outputs from [Competitive Companion](https://github.com/jmerle/competitive-companion) onto the current file
  - 🏃 ***BLAZINGLY FAST!*** Asynchronous design + optimizations = **99%** spam proof!

### 💻 Keybinds

- Compile (if file has compile command and file had changed) and run all testcases: `Ctrl+Alt+B`
- Run stress test: `Ctrl+Alt+G`
- Delete all testcases: `Ctrl+Alt+D`
- Insert file template: `Ctrl+Alt+I`

### ✅ Interested? _[INSTALL](#how-to-install) AND [SET IT UP](#setting-up) RIGHT NOW!_

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

- **The paths have to be absolute!**
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

Required files for the default configuration:
- `<name>.[ext]`: the solution to bruteforce against
- `<name>__Good.[ext]`: the solution that outputs the correct answer
- `<name>__Generator.[ext]`: to generate inputs for the other 2 files

> [!NOTE]
> The output shown may not be expected. Due to the asynchronous nature of Node.js, the extension view may not receive appropriate messages in order.
>
> ***But, when there is a wrong answer, that is true regardless of whatever output is displayed!*** The provided input can be used on both solutions for such cases.

*Gif is recorded at 10FPS but the tester runs as low as 5ms between testcases!*

![Stress Tester Gif](media/stress_tester.gif)

---

### 👜 Inserting Prewritten Code

> [!NOTE]
> Input the absolute path to your library directory in settings to enable this functionality. Otherwise, nothing happens!

![File Template Gif](media/file_template.gif)

---

### 🛜 Competitive Companion

![Competitive Companion Gif](media/competitive_companion.gif)

---

### 📥 How to Install
- VSCode Marketplace: [Fast Olympic Coding](https://marketplace.visualstudio.com/items?itemName=sam20908.vscode-fastolympiccoding)
- Command in Quick Open (`Ctrl+P`): `ext install sam20908.vscode-fastolympiccoding`

---

### © Attributions

- [FastOlympicCoding](https://github.com/Jatana/FastOlympicCoding): The original Sublime Text package that inspired this extension 💖
- [Flaticon](https://www.flaticon.com/): Icon for this extension 💖
