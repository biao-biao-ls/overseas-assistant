const os = require('os')

module.exports = {
    semi: false,
    singleQuote: true,
    jsxBracketSameLine: false,
    jsxSingleQuote: false,
    trailingComma: 'es5',
    endOfLine: os.platform() === 'win32' ? 'crlf' : 'lf',
    printWidth: 300,
    tabWidth: 4,
    useTabs: true,
}
