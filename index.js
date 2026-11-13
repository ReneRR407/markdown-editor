var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;

// Because highlight.js is a bit awkward at times
var languageOverrides = {
    js: 'javascript',
    html: 'xml'
};

var livestyles;

emojify.setConfig({
    img_dir: 'emoji'
});

var md = markdownit({
        html: true,
        highlight: function(code, lang) {
            if (languageOverrides[lang]) lang = languageOverrides[lang];
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(lang, code).value;
                } catch (e) {}
            }
            return '';
        }
    })
    .use(markdownitFootnote);

var hashto;
var isInitializing = true;

function update(e) {
    var val = e.getValue();
    setOutput(val);

    // Grava automaticamente o conteúdo do texto no localStorage a cada alteração
    if (!isInitializing) {
        try {
            localStorage.setItem('content', val);
        } catch (err) {}
    }

    //If a title is added to the document it will be the new document.title, otherwise use default
    var headerElements = document.querySelectorAll('h1');
    if (headerElements.length > 0 && headerElements[0].textContent.length > 0) {
        title = headerElements[0].textContent;
    } else {
        title = 'Editor Markdown';
    }

    //To avoid to much title changing we check if is not the same as before
    oldTitle = document.title;
    if (oldTitle != title) {
        oldTitle = title;
        document.title = title;
    }
    //clearTimeout(hashto);
    //hashto = setTimeout(updateHash, 1000);
}

/*
This function is used to check for task list notation.
If regex matches the string to task-list markdown format,
then the task-list is rendered to its correct form.
User: @austinmm
*/
var render_tasklist = function(str){
    // Checked task-list box match
	if(str.match(/<li>\[x\]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[x\]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
          checked style="list-style-type: none; 
          margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    // Unchecked task-list box match
    if (str.match(/<li>\[ \]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[ \]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
          style="list-style-type: none; 
          margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    return str
}

function updateStats(text) {
    var content = text || "";

    // Contagem de caracteres
    var charCount = content.length;

    // Contagem de linhas
    var lineCount = content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length;

    // Contagem de palavras (considera tokens que contenham letras ou números)
    var trimmed = content.trim();
    var wordCount = 0;
    if (trimmed.length > 0) {
        var tokens = trimmed.split(/\s+/);
        wordCount = tokens.filter(function(token) {
            return /[a-zA-Z0-9\u00C0-\u024F]/.test(token);
        }).length;
    }

    // Tempo estimado de leitura (média de 200 palavras por minuto)
    var wordsPerMinute = 200;
    var readingTimeMinutes = wordCount > 0 ? Math.ceil(wordCount / wordsPerMinute) : 0;

    var wordEl = document.getElementById('word-count');
    var charEl = document.getElementById('char-count');
    var lineEl = document.getElementById('line-count');
    var timeEl = document.getElementById('reading-time');

    if (wordEl) wordEl.textContent = wordCount;
    if (charEl) charEl.textContent = charCount;
    if (lineEl) lineEl.textContent = lineCount;
    if (timeEl) timeEl.textContent = readingTimeMinutes + " min";
}

window.updateStats = updateStats;

function copyTextToClipboard(text, buttonEl) {
    function showCopiedFeedback() {
        if (!buttonEl) return;
        var originalText = "Copiar";
        buttonEl.textContent = "Copiado!";
        buttonEl.classList.add("copied");
        setTimeout(function() {
            buttonEl.textContent = originalText;
            buttonEl.classList.remove("copied");
        }, 2000);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopiedFeedback).catch(function() {
            fallbackCopy(text, showCopiedFeedback);
        });
    } else {
        fallbackCopy(text, showCopiedFeedback);
    }
}

function fallbackCopy(text, callback) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand("copy");
        if (callback) callback();
    } catch (e) {}
    document.body.removeChild(textarea);
}

function injectCopyButtons(container) {
    if (!container) return;
    var preBlocks = container.querySelectorAll("pre");
    for (var i = 0; i < preBlocks.length; i++) {
        (function(pre) {
            var existingBtn = pre.querySelector(".copy-code-btn");
            if (existingBtn) {
                existingBtn.parentNode.removeChild(existingBtn);
            }
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "copy-code-btn";
            btn.title = "Copiar código";
            btn.textContent = "Copiar";
            btn.addEventListener("click", function(e) {
                e.stopPropagation();
                var codeEl = pre.querySelector("code");
                var codeText = codeEl ? (codeEl.innerText || codeEl.textContent) : (pre.innerText || pre.textContent);
                copyTextToClipboard(codeText, btn);
            });
            pre.appendChild(btn);
        })(preBlocks[i]);
    }
}

function updateTOC(rawMarkdown) {
    var tocList = document.getElementById("toc-list");
    var out = document.getElementById("out");
    if (!tocList || !out) return;

    // Localiza as linhas dos cabeçalhos (#, ##, ###, etc.) no código Markdown original
    var markdownHeadingLines = [];
    if (typeof rawMarkdown === "string") {
        var lines = rawMarkdown.split(/\r\n|\r|\n/);
        var inCodeFence = false;
        for (var l = 0; l < lines.length; l++) {
            if (/^\s*```/.test(lines[l])) {
                inCodeFence = !inCodeFence;
                continue;
            }
            if (!inCodeFence && /^#{1,6}\s+.+/.test(lines[l])) {
                markdownHeadingLines.push(l);
            }
        }
    }

    var headings = out.querySelectorAll("h1, h2, h3, h4, h5, h6");
    tocList.innerHTML = "";

    if (headings.length === 0) {
        var emptyMsg = document.createElement("div");
        emptyMsg.className = "toc-empty";
        emptyMsg.textContent = "Nenhum cabeçalho (#, ##, ###) encontrado.";
        tocList.appendChild(emptyMsg);
        return;
    }

    for (var i = 0; i < headings.length; i++) {
        (function(index, headingEl) {
            var level = parseInt(headingEl.tagName.substring(1), 10) || 1;
            var text = (headingEl.textContent || "").trim();
            var headingId = "toc-heading-" + index;
            headingEl.id = headingId;

            var item = document.createElement("a");
            item.className = "toc-item toc-level-" + level;
            item.href = "#" + headingId;
            var hashes = new Array(level + 1).join("#");
            item.textContent = hashes + " " + text;
            item.title = text;

            item.addEventListener("click", function(e) {
                e.preventDefault();
                // Desloca o painel de visualização (#out) até o cabeçalho
                isSyncingRight = true;
                out.scrollTop = Math.max(0, headingEl.offsetTop - 12);
                if (syncRightTimeout) clearTimeout(syncRightTimeout);
                syncRightTimeout = setTimeout(function() {
                    isSyncingRight = false;
                }, 80);

                // Desloca também o editor (#in) até a linha correspondente do cabeçalho
                if (typeof editor !== "undefined" && markdownHeadingLines[index] !== undefined) {
                    var targetLine = markdownHeadingLines[index];
                    isSyncingLeft = true;
                    var coords = editor.charCoords({ line: targetLine, ch: 0 }, "local");
                    editor.scrollTo(null, Math.max(0, coords.top - 12));
                    editor.setCursor({ line: targetLine, ch: 0 });
                    if (syncLeftTimeout) clearTimeout(syncLeftTimeout);
                    syncLeftTimeout = setTimeout(function() {
                        isSyncingLeft = false;
                    }, 80);
                }
            });

            tocList.appendChild(item);
        })(i, headings[i]);
    }
}

function toggleTOC() {
    var panel = document.getElementById("toc-panel");
    var btn = document.getElementById("btn-toc");
    if (!panel) return;
    var isHidden = panel.classList.toggle("hidden");
    if (btn) {
        if (!isHidden) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    }
}

window.toggleTOC = toggleTOC;

function setOutput(val) {
    var rawMarkdown = val;
    updateStats(rawMarkdown);

    val = val.replace(/<equation>((.*?\n)*?.*?)<\/equation>/ig, function(a, b) {
        return '<img src="http://latex.codecogs.com/png.latex?' + encodeURIComponent(b) + '" />';
    });

    var out = document.getElementById('out');
    var old = out.cloneNode(true);
    var oldBtns = old.querySelectorAll('.copy-code-btn');
    for (var b = 0; b < oldBtns.length; b++) {
        oldBtns[b].parentNode.removeChild(oldBtns[b]);
    }

    out.innerHTML = md.render(val);
    emojify.run(out);
    // Checks if there are any task-list present in out.innerHTML
    out.innerHTML = render_tasklist(out.innerHTML);

    var allold = old.getElementsByTagName("*");
    var allnew = out.getElementsByTagName("*");

    if (allold !== undefined && allnew !== undefined) {
        for (var i = 0, max = Math.min(allold.length, allnew.length); i < max; i++) {
            if (!allold[i].isEqualNode(allnew[i])) {
                isSyncingRight = true;
                out.scrollTop = allnew[i].offsetTop;
                if (syncRightTimeout) clearTimeout(syncRightTimeout);
                syncRightTimeout = setTimeout(function() {
                    isSyncingRight = false;
                }, 50);
                break;
            }
        }
    }

    injectCopyButtons(out);
    updateTOC(rawMarkdown);
}

CodeMirrorSpellChecker({
    codeMirrorInstance: CodeMirror,
});

var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    mode: "spell-checker",
    backdrop: "gfm",
    lineNumbers: false,
    matchBrackets: true,
    lineWrapping: true,
    theme: 'base16-light',
    extraKeys: {
        "Enter": "newlineAndIndentContinueMarkdownList"
    }
});

editor.on('change', update);

/* Sincronização proporcional de scroll entre o painel de código (#in) e a pré-visualização (#out) */
var syncScrollEnabled = true;
var isSyncingLeft = false;
var isSyncingRight = false;
var syncLeftTimeout = null;
var syncRightTimeout = null;

function applySyncScrollState(enabled) {
    syncScrollEnabled = Boolean(enabled);
    var btn = document.getElementById('btn-sync-scroll');
    var label = document.getElementById('sync-scroll-label');
    if (btn) {
        if (syncScrollEnabled) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
    if (label) {
        label.textContent = syncScrollEnabled ? 'Rolagem Sincronizada: Ativa' : 'Rolagem Sincronizada: Inativa';
    }
}

function toggleSyncScroll() {
    applySyncScrollState(!syncScrollEnabled);
    try {
        localStorage.setItem('syncScroll', syncScrollEnabled ? 'true' : 'false');
    } catch (e) {}
    if (syncScrollEnabled) {
        syncScrollFromEditor();
    }
}

function initSyncScroll() {
    var saved = null;
    try {
        saved = localStorage.getItem('syncScroll');
    } catch (e) {}
    if (saved !== null) {
        applySyncScrollState(saved === 'true');
    } else {
        applySyncScrollState(true);
    }
}

window.toggleSyncScroll = toggleSyncScroll;

function syncScrollFromEditor() {
    if (!syncScrollEnabled || isSyncingLeft) {
        return;
    }
    var out = document.getElementById('out');
    if (!out) return;

    var scrollInfo = editor.getScrollInfo();
    var editorMaxScroll = scrollInfo.height - scrollInfo.clientHeight;
    var currentScrollTop = scrollInfo.top;

    // Fallback caso o elemento #in tenha scroll próprio
    if (editorMaxScroll <= 0) {
        var inEl = document.getElementById('in');
        if (inEl && (inEl.scrollHeight - inEl.clientHeight) > 0) {
            editorMaxScroll = inEl.scrollHeight - inEl.clientHeight;
            currentScrollTop = inEl.scrollTop;
        }
    }

    var percentage = editorMaxScroll > 0 ? (currentScrollTop / editorMaxScroll) : 0;
    percentage = Math.max(0, Math.min(1, percentage));

    var outMaxScroll = out.scrollHeight - out.clientHeight;
    isSyncingRight = true;
    out.scrollTop = percentage * outMaxScroll;

    if (syncRightTimeout) clearTimeout(syncRightTimeout);
    syncRightTimeout = setTimeout(function() {
        isSyncingRight = false;
    }, 50);
}

function syncScrollFromPreview() {
    if (!syncScrollEnabled || isSyncingRight) {
        return;
    }
    var out = document.getElementById('out');
    if (!out) return;

    var outMaxScroll = out.scrollHeight - out.clientHeight;
    var percentage = outMaxScroll > 0 ? (out.scrollTop / outMaxScroll) : 0;
    percentage = Math.max(0, Math.min(1, percentage));

    var scrollInfo = editor.getScrollInfo();
    var editorMaxScroll = scrollInfo.height - scrollInfo.clientHeight;

    isSyncingLeft = true;
    if (editorMaxScroll > 0) {
        editor.scrollTo(null, percentage * editorMaxScroll);
    } else {
        var inEl = document.getElementById('in');
        if (inEl && (inEl.scrollHeight - inEl.clientHeight) > 0) {
            inEl.scrollTop = percentage * (inEl.scrollHeight - inEl.clientHeight);
        }
    }

    if (syncLeftTimeout) clearTimeout(syncLeftTimeout);
    syncLeftTimeout = setTimeout(function() {
        isSyncingLeft = false;
    }, 50);
}

editor.on('scroll', syncScrollFromEditor);
document.getElementById('in').addEventListener('scroll', syncScrollFromEditor);
document.getElementById('out').addEventListener('scroll', syncScrollFromPreview);

function selectionChanger(selection,operator,endoperator){
    if(selection == ""){
        return operator;
    }
    if(!endoperator){
        endoperator = operator
    }
    var isApplied = selection.slice(0, operator.length) === operator && selection.slice(-endoperator.length) === endoperator;
    var finaltext = isApplied ? selection.slice(operator.length, -endoperator.length) : operator + selection + endoperator;
    return finaltext;
}

/* Barra de Ações Rápidas (Toolbar actions) */

function actionBold() {
    editor.focus();
    var sel = editor.getSelection();
    if (sel.length > 0) {
        // If selection is already wrapped in **
        if (sel.length >= 4 && sel.slice(0, 2) === '**' && sel.slice(-2) === '**') {
            editor.replaceSelection(sel.slice(2, -2), "around");
            return;
        }
        // If selection is surrounded by ** on current line
        var from = editor.getCursor("from");
        var to = editor.getCursor("to");
        if (from.line === to.line && from.ch >= 2) {
            var line = editor.getLine(from.line);
            if (line.slice(from.ch - 2, from.ch) === '**' && line.slice(to.ch, to.ch + 2) === '**') {
                editor.replaceRange(sel, { line: from.line, ch: from.ch - 2 }, { line: to.line, ch: to.ch + 2 });
                editor.setSelection({ line: from.line, ch: from.ch - 2 }, { line: from.line, ch: from.ch - 2 + sel.length });
                return;
            }
        }
        var leadingSpaces = "";
        var trailingSpaces = "";
        var matchLeading = sel.match(/^(\s+)/);
        if (matchLeading) {
            leadingSpaces = matchLeading[1];
            sel = sel.slice(leadingSpaces.length);
        }
        var matchTrailing = sel.match(/(\s+)$/);
        if (matchTrailing) {
            trailingSpaces = matchTrailing[1];
            sel = sel.slice(0, -trailingSpaces.length);
        }
        editor.replaceSelection(leadingSpaces + '**' + sel + '**' + trailingSpaces, "around");
    } else {
        var cursor = editor.getCursor();
        var line = editor.getLine(cursor.line);
        if (cursor.ch >= 2 && line.slice(cursor.ch - 2, cursor.ch) === '**' && line.slice(cursor.ch, cursor.ch + 2) === '**') {
            editor.replaceRange("", { line: cursor.line, ch: cursor.ch - 2 }, { line: cursor.line, ch: cursor.ch + 2 });
            return;
        }
        var placeholder = "texto em negrito";
        editor.replaceSelection('**' + placeholder + '**');
        editor.setSelection(
            { line: cursor.line, ch: cursor.ch + 2 },
            { line: cursor.line, ch: cursor.ch + 2 + placeholder.length }
        );
    }
}

function actionItalic() {
    editor.focus();
    var sel = editor.getSelection();
    if (sel.length > 0) {
        var isWrapped = (sel.length >= 2 && (
            (sel.slice(0, 1) === '*' && sel.slice(-1) === '*' && sel.slice(0, 2) !== '**') ||
            (sel.slice(0, 1) === '_' && sel.slice(-1) === '_' && sel.slice(0, 2) !== '__')
        ));
        if (isWrapped) {
            editor.replaceSelection(sel.slice(1, -1), "around");
            return;
        }
        var from = editor.getCursor("from");
        var to = editor.getCursor("to");
        if (from.line === to.line && from.ch >= 1) {
            var line = editor.getLine(from.line);
            var prevChar = line.slice(from.ch - 1, from.ch);
            var nextChar = line.slice(to.ch, to.ch + 1);
            if ((prevChar === '*' && nextChar === '*') || (prevChar === '_' && nextChar === '_')) {
                editor.replaceRange(sel, { line: from.line, ch: from.ch - 1 }, { line: to.line, ch: to.ch + 1 });
                editor.setSelection({ line: from.line, ch: from.ch - 1 }, { line: from.line, ch: from.ch - 1 + sel.length });
                return;
            }
        }
        var leadingSpaces = "";
        var trailingSpaces = "";
        var matchLeading = sel.match(/^(\s+)/);
        if (matchLeading) {
            leadingSpaces = matchLeading[1];
            sel = sel.slice(leadingSpaces.length);
        }
        var matchTrailing = sel.match(/(\s+)$/);
        if (matchTrailing) {
            trailingSpaces = matchTrailing[1];
            sel = sel.slice(0, -trailingSpaces.length);
        }
        editor.replaceSelection(leadingSpaces + '*' + sel + '*' + trailingSpaces, "around");
    } else {
        var cursor = editor.getCursor();
        var line = editor.getLine(cursor.line);
        if (cursor.ch >= 1 && line.slice(cursor.ch - 1, cursor.ch) === '*' && line.slice(cursor.ch, cursor.ch + 1) === '*') {
            editor.replaceRange("", { line: cursor.line, ch: cursor.ch - 1 }, { line: cursor.line, ch: cursor.ch + 1 });
            return;
        }
        var placeholder = "texto em itálico";
        editor.replaceSelection('*' + placeholder + '*');
        editor.setSelection(
            { line: cursor.line, ch: cursor.ch + 1 },
            { line: cursor.line, ch: cursor.ch + 1 + placeholder.length }
        );
    }
}

function actionCode() {
    editor.focus();
    var sel = editor.getSelection();
    if (sel.length > 0) {
        if (sel.indexOf('\n') !== -1) {
            var trimmed = sel.trim();
            if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
                var lines = trimmed.split('\n');
                if (lines.length >= 2 && lines[0].startsWith('```') && lines[lines.length - 1].trim() === '```') {
                    var inner = lines.slice(1, -1).join('\n');
                    editor.replaceSelection(inner, "around");
                    return;
                }
            }
            editor.replaceSelection('```\n' + sel + '\n```', "around");
            return;
        }
        if (sel.length >= 2 && sel.slice(0, 1) === '`' && sel.slice(-1) === '`') {
            editor.replaceSelection(sel.slice(1, -1), "around");
            return;
        }
        var from = editor.getCursor("from");
        var to = editor.getCursor("to");
        if (from.line === to.line && from.ch >= 1) {
            var line = editor.getLine(from.line);
            if (line.slice(from.ch - 1, from.ch) === '`' && line.slice(to.ch, to.ch + 1) === '`') {
                editor.replaceRange(sel, { line: from.line, ch: from.ch - 1 }, { line: to.line, ch: to.ch + 1 });
                editor.setSelection({ line: from.line, ch: from.ch - 1 }, { line: from.line, ch: from.ch - 1 + sel.length });
                return;
            }
        }
        var leadingSpaces = "";
        var trailingSpaces = "";
        var matchLeading = sel.match(/^(\s+)/);
        if (matchLeading) {
            leadingSpaces = matchLeading[1];
            sel = sel.slice(leadingSpaces.length);
        }
        var matchTrailing = sel.match(/(\s+)$/);
        if (matchTrailing) {
            trailingSpaces = matchTrailing[1];
            sel = sel.slice(0, -trailingSpaces.length);
        }
        editor.replaceSelection(leadingSpaces + '`' + sel + '`' + trailingSpaces, "around");
    } else {
        var cursor = editor.getCursor();
        var line = editor.getLine(cursor.line);
        if (line.trim().length === 0) {
            var blockPlaceholder = "código aqui";
            editor.replaceRange("```\n" + blockPlaceholder + "\n```", { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
            editor.setSelection(
                { line: cursor.line + 1, ch: 0 },
                { line: cursor.line + 1, ch: blockPlaceholder.length }
            );
            return;
        }
        if (cursor.ch >= 1 && line.slice(cursor.ch - 1, cursor.ch) === '`' && line.slice(cursor.ch, cursor.ch + 1) === '`') {
            editor.replaceRange("", { line: cursor.line, ch: cursor.ch - 1 }, { line: cursor.line, ch: cursor.ch + 1 });
            return;
        }
        var placeholder = "código";
        editor.replaceSelection('`' + placeholder + '`');
        editor.setSelection(
            { line: cursor.line, ch: cursor.ch + 1 },
            { line: cursor.line, ch: cursor.ch + 1 + placeholder.length }
        );
    }
}

function actionHeading() {
    editor.focus();
    var cursorFrom = editor.getCursor("from");
    var cursorTo = editor.getCursor("to");
    var startLine = cursorFrom.line;
    var endLine = cursorTo.line;

    if (cursorTo.ch === 0 && endLine > startLine) {
        endLine--;
    }

    for (var lineNo = startLine; lineNo <= endLine; lineNo++) {
        var line = editor.getLine(lineNo);
        if (line.trim().length === 0) {
            var placeholder = "Título";
            editor.replaceRange("# " + placeholder, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
            if (startLine === endLine) {
                editor.setSelection({ line: lineNo, ch: 2 }, { line: lineNo, ch: 2 + placeholder.length });
            }
        } else {
            var match = line.match(/^(#{1,6})\s*(.*)$/);
            if (match) {
                var hashes = match[1];
                var content = match[2];
                if (hashes.length < 3) {
                    var newLine = hashes + "# " + content;
                    editor.replaceRange(newLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
                } else {
                    editor.replaceRange(content, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
                }
            } else {
                var newLine = "# " + line;
                editor.replaceRange(newLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
            }
        }
    }
}

function actionList() {
    editor.focus();
    var cursorFrom = editor.getCursor("from");
    var cursorTo = editor.getCursor("to");
    var startLine = cursorFrom.line;
    var endLine = cursorTo.line;

    if (cursorTo.ch === 0 && endLine > startLine) {
        endLine--;
    }

    var allAreLists = true;
    var lineCount = 0;
    for (var i = startLine; i <= endLine; i++) {
        var text = editor.getLine(i);
        if (text.trim().length > 0) {
            lineCount++;
            if (!text.match(/^\s*[-*+]\s+/)) {
                allAreLists = false;
            }
        }
    }

    if (lineCount === 0) {
        var cursor = editor.getCursor();
        var placeholder = "Item da lista";
        editor.replaceRange("- " + placeholder, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: editor.getLine(cursor.line).length });
        editor.setSelection({ line: cursor.line, ch: 2 }, { line: cursor.line, ch: 2 + placeholder.length });
        return;
    }

    for (var lineNo = startLine; lineNo <= endLine; lineNo++) {
        var line = editor.getLine(lineNo);
        if (allAreLists) {
            var newLine = line.replace(/^(\s*)[-*+]\s+/, '$1');
            editor.replaceRange(newLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
        } else {
            if (!line.match(/^\s*[-*+]\s+/)) {
                var newLine = "- " + line;
                editor.replaceRange(newLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
            }
        }
    }
}

function actionTable() {
    editor.focus();
    var cursor = editor.getCursor();
    var selection = editor.getSelection();

    var tableTemplate = 
"| Coluna 1 | Coluna 2 | Coluna 3 |\n" +
"| -------- | -------- | -------- |\n" +
"| Item 1   | Item 2   | Item 3   |\n" +
"| Item 4   | Item 5   | Item 6   |";

    if (selection.length > 0) {
        var lines = selection.trim().split("\n");
        if (lines.length > 1 || lines[0].indexOf(",") !== -1 || lines[0].indexOf("\t") !== -1) {
            var rows = lines.map(function(line) {
                return line.split(/[,\t|]/).map(function(c) { return c.trim(); }).filter(function(c) { return c.length > 0; });
            }).filter(function(r) { return r.length > 0; });

            if (rows.length > 0) {
                var maxCols = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 0);
                if (maxCols > 1) {
                    var out = "| " + rows[0].map(function(c, i) { return c || ("Coluna " + (i + 1)); }).join(" | ") + " |\n";
                    out += "| " + rows[0].map(function() { return "--------"; }).join(" | ") + " |\n";
                    for (var r = 1; r < rows.length; r++) {
                        var rowCells = [];
                        for (var c = 0; c < maxCols; c++) {
                            rowCells.push(rows[r][c] || "");
                        }
                        out += "| " + rowCells.join(" | ") + " |\n";
                    }
                    editor.replaceSelection(out.trim());
                    return;
                }
            }
        }
        editor.replaceSelection(tableTemplate);
    } else {
        var line = editor.getLine(cursor.line);
        var prefix = "";
        if (cursor.line > 0 && line.length > 0) {
            prefix = "\n\n";
        } else if (line.trim().length > 0) {
            prefix = "\n";
        }
        var textToInsert = prefix + tableTemplate;
        editor.replaceRange(textToInsert, cursor);
        var headerLine = cursor.line + (prefix ? prefix.split("\n").length - 1 : 0);
        editor.setSelection(
            { line: headerLine, ch: 2 },
            { line: headerLine, ch: 10 }
        );
    }
}

// Aliases for global accessibility and programmatic use
window.actionBold = window.insertBold = actionBold;
window.actionItalic = window.insertItalic = actionItalic;
window.actionCode = window.insertCode = actionCode;
window.actionHeading = window.insertHeading = actionHeading;
window.actionList = window.insertList = actionList;
window.actionTable = window.insertTable = actionTable;

function initToolbar() {
    var toolbar = document.getElementById('toolbar');
    if (!toolbar) return;
    var buttons = toolbar.querySelectorAll('.toolbar-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('mousedown', function(e) {
            e.preventDefault();
        });
    }
}

editor.addKeyMap({
    // bold
    'Ctrl-B': function(cm) {
        actionBold();
    },
    // italic
    'Ctrl-I': function(cm) {
        actionItalic();
    },
    // code
    'Ctrl-K': function(cm) {
        actionCode();
    },
    // heading
    'Ctrl-H': function(cm) {
        actionHeading();
    },
    // keyboard shortcut
    'Ctrl-L': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'<kbd>','</kbd>'));
    }
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var reader = new FileReader();
    reader.onload = function(e) {
        editor.setValue(e.target.result);
    };

    reader.readAsText(e.dataTransfer.files[0]);
}, false);

function getSafeFileName(ext) {
    var baseName = document.title.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '');
    if (!baseName) {
        baseName = "documento";
    }
    return baseName + ext;
}

//Print the document named as the document title encoded to avoid strange chars and spaces
function saveAsMarkdown() {
    save(editor.getValue(), getSafeFileName(".md"));
}

//Print the document named as the document title encoded to avoid strange chars and spaces
function saveAsHtml() {
    save(document.getElementById('out').innerHTML, getSafeFileName(".html"));
}

window.saveAsMarkdown = saveAsMarkdown;
window.saveAsHtml = saveAsHtml;

document.getElementById('saveas-markdown').addEventListener('click', function() {
    saveAsMarkdown();
    hideMenu();
});

document.getElementById('saveas-html').addEventListener('click', function() {
    saveAsHtml();
    hideMenu();
});

function save(code, name) {
    var blob = new Blob([code], {
        type: 'text/plain;charset=utf-8'
    });
    if (window.saveAs) {
        window.saveAs(blob, name);
    } else if (navigator.saveBlob) {
        navigator.saveBlob(blob, name);
    } else {
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function() {
            URL.revokeObjectURL(url);
        }, 100);
    }
}

var menuVisible = false;
var menu = document.getElementById('menu');

function showMenu() {
    menuVisible = true;
    menu.style.display = 'block';
}

function hideMenu() {
    menuVisible = false;
    menu.style.display = 'none';
}

function openFile(evt) {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var files = evt.target.files;
        console.log(files);
        var reader = new FileReader();
        reader.onload = function(file) {
            console.log(file.target.result);
            editor.setValue(file.target.result);
            return true;
        };
        reader.readAsText(files[0]);

    } else {
        alert('As APIs de arquivo não são totalmente suportadas neste navegador.');
    }
}

document.getElementById('close-menu').addEventListener('click', function() {
    hideMenu();
});

document.addEventListener('keydown', function(e) {
    if (e.keyCode == 83 && (e.ctrlKey || e.metaKey)) {
        if ( localStorage.getItem('content') == editor.getValue() ) {
            e.preventDefault();
            return false;
        }
        e.shiftKey ? showMenu() : saveInBrowser();

        e.preventDefault();
        return false;
    }

    if (e.keyCode === 27 && menuVisible) {
        hideMenu();

        e.preventDefault();
        return false;
    }
});

function clearEditor() {
    editor.setValue("");
}

function saveInBrowser() {
    var text = editor.getValue();
    if (localStorage.getItem('content')) {
        swal({
                title: "Dados Existentes Detectados",
                text: "Você irá sobrescrever os dados salvos anteriormente!",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Sim, sobrescrever!",
                cancelButtonText: "Cancelar",
                closeOnConfirm: false
            },
            function() {
                localStorage.setItem('content', text);
                swal("Salvo!", "Seu documento foi salvo com sucesso.", "success");
            });
    } else {
        localStorage.setItem('content', text);
        swal("Salvo!", "Seu documento foi salvo com sucesso.", "success");
    }
    console.log("Salvo");
}

var availableThemes = [
    { id: 'default', className: '', label: 'Padrão' },
    { id: 'theme-dark', className: 'theme-dark', label: 'Escuro Clássico' },
    { id: 'theme-dracula', className: 'theme-dracula', label: 'Dracula' },
    { id: 'theme-monokai', className: 'theme-monokai', label: 'Monokai' },
    { id: 'theme-solarized', className: 'theme-solarized', label: 'Solarized' },
    { id: 'theme-neon', className: 'theme-neon', label: 'Neon' }
];
var currentThemeIndex = 0;

function applyThemeByIndex(index) {
    currentThemeIndex = ((index % availableThemes.length) + availableThemes.length) % availableThemes.length;
    var themeObj = availableThemes[currentThemeIndex];
    var body = document.body;

    // Remove todas as classes de tema anteriores do <body>
    for (var i = 0; i < availableThemes.length; i++) {
        if (availableThemes[i].className) {
            body.classList.remove(availableThemes[i].className);
        }
    }
    body.classList.remove('nightmode');

    // Injeta a classe do tema selecionado no <body>
    if (themeObj.className) {
        body.classList.add(themeObj.className);
    }

    var nightBtn = document.getElementById('nightbutton');
    var badge = document.getElementById('theme-badge');
    if (nightBtn) {
        if (themeObj.className) {
            nightBtn.classList.add('selected');
        } else {
            nightBtn.classList.remove('selected');
        }
        nightBtn.setAttribute('title', 'Tema atual: ' + themeObj.label + ' (Clique para alternar)');
    }
    if (badge) {
        badge.textContent = themeObj.label;
    }

    try {
        localStorage.setItem('theme', themeObj.id);
    } catch (e) {}
}

function initTheme() {
    var savedThemeId = 'default';
    try {
        savedThemeId = localStorage.getItem('theme') || 'default';
    } catch (e) {}

    var foundIndex = 0;
    for (var i = 0; i < availableThemes.length; i++) {
        if (availableThemes[i].id === savedThemeId || availableThemes[i].className === savedThemeId) {
            foundIndex = i;
            break;
        }
    }
    applyThemeByIndex(foundIndex);
}

function toggleNightMode(button) {
    applyThemeByIndex(currentThemeIndex + 1);
}

window.toggleNightMode = toggleNightMode;

function toggleReadMode(button) {
    button.classList.toggle('selected');
    document.getElementById('out').classList.toggle('focused');
    document.getElementById('in').classList.toggle('hidden');
    var toolbar = document.getElementById('toolbar');
    if (toolbar) {
        toolbar.classList.toggle('hidden');
    }
}

function toggleSpellCheck(button) {
    button.classList.toggle('selected');
    document.body.classList.toggle('no-spellcheck');
}

function updateHash() {
    window.location.hash = btoa( // base64 so url-safe
        RawDeflate.deflate( // gzip
            unescape(encodeURIComponent( // convert to utf8
                editor.getValue()
            ))
        )
    );
}

function processQueryParams() {
    var params = window.location.search.split('?')[1];
    if (window.location.hash) {
        document.getElementById('readbutton').click(); // Show reading view
    }
    if (params) {
        var obj = {};
        params.split('&').forEach(function(elem) {
            obj[elem.split('=')[0]] = elem.split('=')[1];
        });
        if (obj.reading === 'false') {
            document.getElementById('readbutton').click(); // Hide reading view
        }
        if (obj.dark === 'true') {
            applyThemeByIndex(1); // Show Dracula theme
        }
    }
}

function start() {
    initTheme();
    initSyncScroll();
    processQueryParams();
    if (window.location.hash) {
        var h = window.location.hash.replace(/^#/, '');
        if (h.slice(0, 5) == 'view:') {
            setOutput(decodeURIComponent(escape(RawDeflate.inflate(atob(h.slice(5))))));
            document.body.className = 'view';
        } else {
            editor.setValue(
                decodeURIComponent(escape(
                    RawDeflate.inflate(
                        atob(
                            h
                        )
                    )
                ))
            );
        }
    } else if (localStorage.getItem('content') !== null) {
        editor.setValue(localStorage.getItem('content'));
    }
    isInitializing = false;
    update(editor);
    initToolbar();
    editor.focus();
    document.getElementById('fileInput').addEventListener('change', openFile, false);
}

window.addEventListener("beforeunload", function (e) {
    if (!editor.getValue() || editor.getValue() == localStorage.getItem('content')) {
        return;
    }
    var confirmationMessage = 'Parece que você editou o documento. '
                            + 'Se sair antes de salvar, suas alterações serão perdidas.';
    (e || window.event).returnValue = confirmationMessage; //Gecko + IE
    return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

start();