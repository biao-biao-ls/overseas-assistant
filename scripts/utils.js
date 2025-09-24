const childProcess = require('child_process')

// 运行命令
function run(command) {
    const options = command.split(' ')
    const cmd = options[0]
    const args = options.slice(1)
    return execAsync(cmd, args, { shell: process.platform === 'win32', stdio: 'inherit', cwd: process.cwd() })
}

function myexec(command, args, options) {
    const win32 = process.platform === 'win32'
    const cmd = win32 ? 'cmd' : command
    const cmdArgs = win32 ? ['/c', command].concat(args) : args
    return require('child_process').spawn(cmd, cmdArgs, options || {})
}

function execAsync(command, args, options) {
    return new Promise((resolve, reject) => {
        const p = myexec(command, args, options)
        p.on('error', err => {
            reject(err)
        })

        p.on('exit', code => {
            if (code === 0) {
                resolve(code)
            } else {
                reject(new Error(`Command failed with exit code ${code}`))
            }
        })
    })
}

module.exports = {
    run,
    execAsync,
}
