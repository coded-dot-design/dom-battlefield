import {readFileSync,writeFileSync} from 'node:fs';import{createHash}from'node:crypto';
const files=['index.html','assets/battlefield.js','assets/battlefield.css','manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png'];
writeFileSync('dist/build.json',JSON.stringify({version:JSON.parse(readFileSync('package.json')).version,files:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(`dist/${file}`)).digest('hex')]))},null,2)+'\n');
