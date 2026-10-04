/**
 * Python-Importe für die Registry-Engine (SEC-035).
 *
 * Ein Import-Name ist kein Distributionsname (`import yaml` kommt aus PyYAML)
 * und lokale Module außerhalb des Diffs sind unsichtbar. Dieses Modul hält
 * deshalb alles aus der Prüfung heraus, was sicher kein PyPI-Paket ist:
 * Standardbibliothek, Namen mit führendem Unterstrich, Fließtext und Zeilen
 * in Docstrings (LANGUAGE_COVERAGE_SPEC §4.4: 50 von 50 Fehlalarme auf Flask).
 */

/**
 * `sys.stdlib_module_names` aus CPython 3.13, dazu die zwischen 3.8 und 3.13
 * entfernten Module und die Python-2-Namen, die in Altcode noch vorkommen.
 * Ein Name auf dieser Liste ist nie ein Registry-Befund.
 */
const PYTHON_STDLIB: ReadonlySet<string> = new Set([
    'abc', 'aifc', 'antigravity', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore', 'atexit',
    'audioop', 'base64', 'bdb', 'binascii', 'binhex', 'bisect', 'builtins', 'bz2', 'cProfile', 'calendar',
    'cgi', 'cgitb', 'chunk', 'cmath', 'cmd', 'code', 'codecs', 'codeop', 'collections', 'colorsys',
    'compileall', 'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg', 'crypt',
    'csv', 'ctypes', 'curses', 'dataclasses', 'datetime', 'dbm', 'decimal', 'difflib', 'dis', 'distutils',
    'doctest', 'email', 'encodings', 'ensurepip', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp',
    'fileinput', 'fnmatch', 'formatter', 'fractions', 'ftplib', 'functools', 'gc', 'genericpath', 'getopt',
    'getpass', 'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http',
    'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
    'keyword', 'lib2to3', 'linecache', 'locale', 'logging', 'lzma', 'macpath', 'mailbox', 'mailcap',
    'marshal', 'math', 'mimetypes', 'mmap', 'modulefinder', 'msilib', 'msvcrt', 'multiprocessing', 'netrc',
    'nis', 'nntplib', 'nt', 'ntpath', 'nturl2path', 'numbers', 'opcode', 'operator', 'optparse', 'os',
    'ossaudiodev', 'parser', 'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform',
    'plistlib', 'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats', 'pty', 'pwd', 'py_compile',
    'pyclbr', 'pydoc', 'pydoc_data', 'pyexpat', 'queue', 'quopri', 'random', 're', 'readline', 'reprlib',
    'resource', 'rlcompleter', 'runpy', 'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex',
    'shutil', 'signal', 'site', 'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3',
    'sre_compile', 'sre_constants', 'sre_parse', 'ssl', 'stat', 'statistics', 'string', 'stringprep',
    'struct', 'subprocess', 'sunau', 'symbol', 'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny',
    'tarfile', 'telnetlib', 'tempfile', 'termios', 'textwrap', 'this', 'threading', 'time', 'timeit',
    'tkinter', 'token', 'tokenize', 'tomllib', 'trace', 'traceback', 'tracemalloc', 'tty', 'turtle',
    'turtledemo', 'types', 'typing', 'unicodedata', 'unittest', 'urllib', 'uu', 'uuid', 'venv', 'warnings',
    'wave', 'weakref', 'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp',
    'zipfile', 'zipimport', 'zlib', 'zoneinfo',
    // Python 2 (Altcode, z. B. kubernetes/examples `from urlparse import urlparse`).
    'BaseHTTPServer', 'ConfigParser', 'Cookie', 'HTMLParser', 'Queue', 'SimpleHTTPServer', 'SocketServer',
    'StringIO', 'Tkinter', 'UserDict', 'cPickle', 'cStringIO', 'commands', 'cookielib', 'exceptions',
    'httplib', 'md5', 'sets', 'thread', 'urllib2', 'urlparse', 'xmlrpclib',
]);

/**
 * `import a.b`, `import a as b`, `import a, b` — der Rest der Zeile muss eine
 * gültige Fortsetzung sein. „import name of your application.“ ist Fließtext.
 */
const IMPORT_STATEMENT = /^\s*import\s+([A-Za-z_][\w.]*)(?:\s+as\s+[A-Za-z_]\w*)?\s*(?:,.*)?(?:[#;].*)?$/;
const FROM_IMPORT_STATEMENT = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+(?:\(|\*|[A-Za-z_])/;
const TRIPLE_QUOTE = /"""|'''/;

/**
 * Wurzelmodul eines Python-Imports, das auf PyPI geprüft werden kann — oder
 * null für Standardbibliothek, private Namen und alles, was kein Import ist.
 * PyPI-Namen beginnen nie mit einem Unterstrich (PEP 508), `__future__` und
 * `_typeshed` sind deshalb ohne Liste ausgeschlossen.
 */
export function extractPythonImportRoot(lineText: string): string | null {
    const importMatch = IMPORT_STATEMENT.exec(lineText) ?? FROM_IMPORT_STATEMENT.exec(lineText);
    const rootModule = importMatch?.[1].split('.')[0];
    if (rootModule === undefined || rootModule.startsWith('_') || PYTHON_STDLIB.has(rootModule)) return null;
    return rootModule;
}

/**
 * Zeilen, die in einem dreifach gequoteten String liegen (Docstrings mit
 * Beispielcode wie `from yourapplication import default_config`). Eine Lücke
 * in den Zeilennummern (Patch-only, neuer Hunk) setzt den Zustand zurück:
 * dort ist unbekannt, ob ein Block offen ist.
 */
export function collectPythonStringBlockLines(lineTexts: ReadonlyMap<number, string>): ReadonlySet<number> {
    const blockLines = new Set<number>();
    let openDelimiter: string | null = null;
    let previousLineNumber = Number.NEGATIVE_INFINITY;

    for (const lineNumber of [...lineTexts.keys()].sort((left, right) => left - right)) {
        if (lineNumber !== previousLineNumber + 1) openDelimiter = null;
        previousLineNumber = lineNumber;
        if (openDelimiter !== null) blockLines.add(lineNumber);
        openDelimiter = advanceStringBlockState(lineTexts.get(lineNumber) ?? '', openDelimiter);
    }
    return blockLines;
}

/** Liefert den nach dieser Zeile offenen Delimiter, oder null. */
function advanceStringBlockState(lineText: string, openDelimiter: string | null): string | null {
    let remainingText = lineText;
    let currentDelimiter = openDelimiter;

    for (;;) {
        if (currentDelimiter !== null) {
            const closingIndex = remainingText.indexOf(currentDelimiter);
            if (closingIndex === -1) return currentDelimiter;
            remainingText = remainingText.slice(closingIndex + currentDelimiter.length);
            currentDelimiter = null;
        }
        const openingMatch = TRIPLE_QUOTE.exec(remainingText);
        if (!openingMatch) return null;
        currentDelimiter = openingMatch[0];
        remainingText = remainingText.slice(openingMatch.index + currentDelimiter.length);
    }
}
