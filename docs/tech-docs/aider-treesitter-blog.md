GPT-4 is great at “self contained” coding tasks, like writing or modifying a pure function with no external dependencies. GPT can easily handle requests like “write a Fibonacci function” or “rewrite this loop using list comprehensions”, because they require no context beyond the code being discussed.

Most real code is not pure and self-contained, it is intertwined with and depends on code from many different files in a repo. If you ask GPT to “switch all the print statements in class Foo to use the BarLog logging system”, it needs to see and modify the code in the Foo class, but it also needs to understand how to use the project’s BarLog subsystem.

A simple solution is to **send the entire codebase** to GPT along with each change request. Now GPT has all the context! But this won’t work for even moderately sized repos, because they won’t fit into the context window.

A better approach is to be selective, and **hand pick which files to send**. For the example above, you could send the file that contains the Foo class and the file that contains the BarLog logging subsystem. This works pretty well, and is supported by aider – you can manually specify which files to “add to the chat” you are having with GPT.

But sending whole files is a bulky way to send code context, wasting the precious context window. GPT doesn’t need to see the entire implementation of BarLog, it just needs to understand it well enough to use it. You may quickly run out of context window by sending full files of code just to convey context.

Aider also strives to reduce the manual work involved in coding with AI. So in an ideal world, we’d like aider to automatically identify and provide the needed code context.

[](https://aider.chat/2023/10/22/repomap.html#using-a-repo-map-to-provide-context) Using a repo map to provide context
----------------------------------------------------------------------------------------------------------------------

Aider sends a **repo map** to GPT along with each request from the user to make a code change. The map contains a list of the files in the repo, along with the key symbols which are defined in each file. It shows how each of these symbols are defined in the source code, by including the critical lines of code for each definition.

Here’s a sample of the map of the aider repo, just showing the maps of [base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py) and [commands.py](https://github.com/Aider-AI/aider/blob/main/aider/commands.py) :

```
aider/coders/base_coder.py:
⋮...
│class Coder:
│    abs_fnames = None
⋮...
│    @classmethod
│    def create(
│        self,
│        main_model,
│        edit_format,
│        io,
│        skip_model_availabily_check=False,
│        **kwargs,
⋮...
│    def abs_root_path(self, path):
⋮...
│    def run(self, with_message=None):
⋮...

aider/commands.py:
⋮...
│class Commands:
│    voice = None
│
⋮...
│    def get_commands(self):
⋮...
│    def get_command_completions(self, cmd_name, partial):
⋮...
│    def run(self, inp):
⋮...
```

Mapping out the repo like this provides some key benefits:

*   GPT can see classes, methods and function signatures from everywhere in the repo. This alone may give it enough context to solve many tasks. For example, it can probably figure out how to use the API exported from a module just based on the details shown in the map.
*   If it needs to see more code, GPT can use the map to figure out by itself which files it needs to look at in more detail. GPT will then ask to see these specific files, and aider will automatically add them to the chat context.

[](https://aider.chat/2023/10/22/repomap.html#optimizing-the-map) Optimizing the map
------------------------------------------------------------------------------------

Of course, for large repositories even just the repo map might be too large for GPT’s context window. Aider solves this problem by sending just the **most relevant** portions of the repo map. It does this by analyzing the full repo map using a graph ranking algorithm, computed on a graph where each source file is a node and edges connect files which have dependencies. Aider optimizes the repo map by selecting the most important parts of the codebase which will fit into the token budget assigned by the user (via the `--map-tokens` switch, which defaults to 1k tokens).

The sample map shown above doesn’t contain _every_ class, method and function from those files. It only includes the most important identifiers, the ones which are most often referenced by other portions of the code. These are the key pieces of context that GPT needs to know to understand the overall codebase.

[](https://aider.chat/2023/10/22/repomap.html#using-tree-sitter-to-make-the-map) Using tree-sitter to make the map
------------------------------------------------------------------------------------------------------------------

Under the hood, aider uses [tree sitter](https://tree-sitter.github.io/tree-sitter/) to build the map. It specifically uses the [py-tree-sitter-languages](https://github.com/grantjenks/py-tree-sitter-languages) python module, which provides simple, pip-installable binary wheels for [most popular programming languages](https://github.com/Aider-AI/grep-ast/blob/main/grep_ast/parsers.py).

Tree-sitter parses source code into an Abstract Syntax Tree (AST) based on the syntax of the programming language. Using the AST, we can identify where functions, classes, variables, types and other definitions occur in the source code. We can also identify where else in the code these things are used or referenced.

Aider uses all of these definitions and references to determine which are the most important identifiers in the repository, and to produce the repo map that shows just those key lines from the codebase.

The tree-sitter repository map replaces the [ctags based map](https://aider.chat/docs/ctags.html) that aider originally used. Switching from ctags to tree-sitter provides a bunch of benefits:

*   The map is richer, showing full function call signatures and other details straight from the source files.
*   Thanks to `py-tree-sitter-languages`, we get full support for many programming languages via a python package that’s automatically installed as part of the normal `python -m pip install -U aider-chat`.
*   We remove the requirement for users to manually install `universal-ctags` via some external tool or package manager (brew, apt, choco, etc).
*   Tree-sitter integration is a key enabler for future work and capabilities for aider.