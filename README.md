<h3 align="center">⚡ Fast Olympic Coding ⚡</h3>

![Testcases Gif](media/demo.gif)

<p align="center">
<img src="https://vsmarketplacebadges.dev/version-short/sam20908.vscode-fastolympiccoding.svg">
<img src="https://vsmarketplacebadges.dev/installs-short/sam20908.vscode-fastolympiccoding.svg">
<img src="https://vsmarketplacebadges.dev/rating-short/sam20908.vscode-fastolympiccoding.svg">
</p>

Fast Olympic Coding is an extension to assist with various tasks in competitive programming. It is a ported and enhanced version of the corresponding Sublime Text plugin that also leverages the power of VSCode.

### ⚡ Overview

  - [📜](#-testcase-window) Concurrently run, edit, and delete multiple testcases
  - [👨🏻‍💻](#-stress-tester) Stress tester to find counterexamples
  - [👜](#-inserting-prewritten-code) Insert pre-written code from another file with automatic folding
  - [🛜](#-competitive-companion) Reads testcases and outputs from [Competitive Companion](https://github.com/jmerle/competitive-companion) onto the current file
  - 🏃 ***BLAZINGLY FAST!*** Asynchronous design + optimizations = **99%** spam proof!

### 💻 Keybinds

- Compile (if file has compile command and file had changed) and run all testcases: `Ctrl+Alt+B`
- Stop all testcases: `Ctrl+Alt+K`
- Delete all testcases: `Ctrl+Alt+D`
- Run stress test: `Ctrl+Alt+G`
- Insert file template: `Ctrl+Alt+I`

### 📥 Installation: [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=sam20908.vscode-fastolympiccoding)
---

### </> Setting Up

Provide run settings for the languages you use in `settings.json`. Here are some examples for C++, Python, and Java:
```json
{
  "fastolympiccoding.runSettings": {
    ".cpp": {
      "compileCommand": "g++ -std=gnu++20 -D_GLIBCXX_DEBUG ${path:${file}} -o ${path:${fileDirname}/${fileBasenameNoExtension}${exeExtname}}",
      "runCommand": "${path:${fileDirname}/${fileBasenameNoExtension}${exeExtname}}"
    },
    ".py": {
      "runCommand": "python ${path:${file}}"
    },
    ".java": {
      "compileCommand": "javac ${path:${file}}",
      "runCommand": "java -cp ${fileDirname} ${fileBasenameNoExtension}"
    }
  }
}
```
We can use the following variables in the syntax of `${...}`
- Most of [VSCode's built-in variables](https://code.visualstudio.com/docs/editor/variables-reference)
- `${exeExtname}` returns `.exe` for Windows and an empty string for other platforms
- `${path:*some value*}` turns \*some value\* into a valid path string for the current platform, which normalizes slashes and handles spaces

---

### 📜 Testcase Window

Trailing whitespaces matter when comparing answers because some problems require an exact format of the answer.

![LeetCode Gif](media/leetcode.gif)

You can also view wrong answers in a diff view.

![Diff AC Image](media/diff-ac.png)

---

### 👨🏻‍💻 Stress Tester

Required files (naming scheme configurable in settings):
- `<name>.[ext]`: the solution to bruteforce against
- `<name>__Good.[ext]`: the solution that outputs the correct answer
- `<name>__Generator.[ext]`: to generate inputs for the other 2 files
  - **The extension provides a 64-bit integer seed input for random number generators!**

*Gif is recorded at 15FPS but the tester runs as low as 5ms between testcases!*

![Stress Tester Gif](media/stress_tester.gif)

---

### 👜 Inserting Prewritten Code

- **Specify your library directory in settings to enable this functionality. Otherwise, nothing happens!**
- **Make sure there is no newlines at the end of your templates for the folding to work!**

![File Template Gif](media/insert_file_template.gif)

---

### 🛜 Competitive Companion

- **Open the extension's tab on VSCode's sidebar to activate the process of listening for Competitive Companion first!**

![Competitive Companion Gif](media/competitive_companion.gif)

---

### © Attributions

- [FastOlympicCoding](https://github.com/Jatana/FastOlympicCoding): The original Sublime Text package that inspired this extension 💖
- [Flaticon](https://www.flaticon.com/): Icon for this extension 💖
