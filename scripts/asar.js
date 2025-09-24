const path = require('path')
const { run } = require('./utils')
const {
    name,
    version,
    description,
    main,
    author,
    license,
    dependencies,
} = require('../package.json')
const fs = require('fs-extra')

if (fs.existsSync('setup/asar')) {
    fs.removeSync('setup/asar')
}

fs.ensureDirSync('setup/asar')
fs.writeFileSync(
    'setup/asar/package.json',
    JSON.stringify(
        {
            name,
            version,
            description,
            main,
            author,
            license,
            dependencies,
        },
        null,
        2
    )
)
// fs.copySync(path.join(__dirname, '../build', path.join(__dirname, '../setup/asar/build')))

fs.copySync(path.join(__dirname, '../build'), path.join(__dirname, '../setup/asar/build'))

run('asar pack setup/asar setup/app.asar').then(() => {
    fs.removeSync('setup/asar')
    console.log('Asar package created successfully.')
}).catch((error) => {
    console.error('Error creating asar package:', error)
})