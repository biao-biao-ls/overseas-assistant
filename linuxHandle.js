
const fs = require('fs');
const compressing = require('compressing');
const path = require('path');
const { version } = require("./package.json");


let strZipFile = path.join(__dirname, `./package/JLCONE-${version}.zip`  )
let strDir = path.join(__dirname, `./package/JLCONE-linux-x64-${version}/JLCONE`)
let strLinuxPackage = path.join(__dirname, `./package/JLCONE-linux-x64-${version}`)
let strLinux = path.join(__dirname, `./src/linux`)


// let nCheckTick
// let bStartHandle = false 
// nCheckTick = setInterval(() => {
//     console.log("check zip finish:" + fs.existsSync(strZipFile))
//     if(!fs.existsSync(strZipFile)){
//         return
//     }
//     bStartHandle = true
//     if(nCheckTick){
//         clearInterval(nCheckTick)
//     }
   
// }, 1000);

checkAll()

function checkAll(){
    if(!fs.existsSync(strLinuxPackage)){
        fs.readFile(strZipFile,(err, fileBuffer)=>{    
            if(err){
               throw err;
            }
        
            compressing.zip.uncompress(strZipFile, strDir).then(() => {
                handleFile()    
            })
        
        });
    }else{
        handleFile()
    }
}


function handleFile(){
    fs.cp(strLinux, strLinuxPackage,{ recursive: true }, (err) => {
        if (err) {
          console.error(err);
        }
      })

}

  
