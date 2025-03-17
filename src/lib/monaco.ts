import * as monaco from 'monaco-editor';

// Import the workers in a production-safe way.
// This is different than in Monaco's documentation for Vite,
// but avoids a weird error ("Unexpected usage") at runtime
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
    getWorker: function (_: string, label: string) {
        switch (label) {
            case 'json':
                return new jsonWorker();
            case 'css':
            case 'scss':
            case 'less':
                return new cssWorker();
            case 'html':
            case 'handlebars':
            case 'razor':
                return new htmlWorker();
            case 'typescript':
            case 'javascript':
                return new tsWorker();
            default:
                return new editorWorker();
        }
    }
};

// Register a new language
monaco.languages.register({ id: "letterpress" });

// Register a tokens provider for the language
monaco.languages.setMonarchTokensProvider("letterpress", {
    tokenizer: {
        root: [
            [/import/, "letterpress.preamble.reserved"],
            [/doctype/, "letterpress.preamble.reserved"],
            [/"[^"]*"/, "letterpress.preamble.reserved"],
            [/==+/, "letterpress.preamble.separator"],
            [/\\[A-z]+/, "letterpress.preamble.reserved"],
            [/\[.*>\]/, "letterpress.content.env"],
            [/\[<.*\]/, "letterpress.content.env"],
        ],
    },
});

// Define a new theme that contains only rules that match this language
monaco.editor.defineTheme("letterpress", {
    base: "vs",
    inherit: false,
    rules: [
        { token: "letterpress.preamble.reserved", foreground: "808080", fontStyle: "bold" },
        { token: "letterpress.preamble.separator", foreground: "374151", fontStyle: "bold" },
        { token: "letterpress.content.env", foreground: "9CA3AF" },
    ],
    colors: {
        "background": "#1F2937",
        "foreground": "#ffffff",

        "editor.background": "#1F2937",
        "editor.foreground": "#ffffff",
        "editor.selectionBackground": "#3B82F64d",
        "editor.lineHighlightBackground": "#00000022",

        "editorGutter.background": "#1F2937", /* todo: make darker */

        "editorCursor.foreground": "#ffffff",

        "editorLineNumber.foreground": "#ffffff4d",
        "editorLineNumber.activeForeground": "#ffffff22",

        "widget.shadow": "#00000066",
        "scrollbar.shadow": "#00000066",

        "dropdown.background": "#1F2937",

        "list.focusBackground": "#1F2937",
    },
});

// Register a completion item provider for the new language
monaco.languages.registerCompletionItemProvider("letterpress", {
    provideCompletionItems: (model, position) => {
        var word = model.getWordUntilPosition(position);
        var range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
        };
        var suggestions = [
            {
                label: "simpleText",
                kind: monaco.languages.CompletionItemKind.Text,
                insertText: "simpleText",
                range: range,
            },
            {
                label: "testing",
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: "testing(${1:condition})",
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule
                        .InsertAsSnippet,
                range: range,
            },
            {
                label: "ifelse",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: [
                    "if (${1:condition}) {",
                    "\t$0",
                    "} else {",
                    "\t",
                    "}",
                ].join("\n"),
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule
                        .InsertAsSnippet,
                documentation: "If-Else Statement",
                range: range,
            },
        ];
        return { suggestions: suggestions };
    },
});

export const ssr = false;
export default monaco;