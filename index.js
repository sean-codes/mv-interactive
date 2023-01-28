#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

var DIRECTORY = process.cwd()

var renderHeight = 6
var renderWidth = process.stdout.columns
var writtenLines = 0

// console.log('[navigate=arrow keys | select=spacebar | confirm=return | escape=esc]')
console.log('')


var data = {
   path: DIRECTORY,
   cursor: 0,
   files: getFiles(DIRECTORY),
   selected: [],
   page: 'select',
   confirm: true,
}

function getFiles(dirPath) {
   var files = fs.readdirSync(dirPath)
   var mapped = files.map((f) => {
      return { name: f, path: dirPath }
   })

   var sorted = mapped.sort((a, b) => a.name.localeCompare(b.name))
   return sorted
}

function matchFiles(f1, f2) {
   return (f1.name == f2.name && f1.path == f2.path) 
}

function moveSelectedFiles() {
   var isSafeMove = true // only a basic check. not really safe :>

   for (var file of data.selected) {
      var oldPath = path.join(file.path, file.name)
      var newPath = path.join(data.path, file.name)

      // old = /folder1
      // new = /folder1/folder1
      if (newPath.startsWith(oldPath)) {
         console.log('ERROR!!!! STOP!!!')
         isSafeMove = false
      }
   }


   if (isSafeMove) {
      for (var file of data.selected) {
         var oldPath = path.join(file.path, file.name)
         var newPath = path.join(data.path, file.name)
         // console.log('Moving', oldPath, 'to', newPath)
         fs.renameSync(oldPath, newPath)
      }

      console.log('Move complete')
   }
}

listenForKeyPress((key) => {
   if (key === 'up') {
      data.cursor = Math.max(0, data.cursor - 1)
      data.confirm = !data.confirm
   }
   if (key === 'down') {
      data.cursor = Math.min(data.files.length-1, data.cursor + 1)
      data.confirm = !data.confirm
   }

   // move path back 1
   if (key === 'left') {
      if (data.page == 'confirm') {
         data.page = 'select'
      } else {
         var newPath = data.path.split('/')
         newPath.pop()
         data.path = newPath.length > 1 ? newPath.join('/') : '/'
         data.files = getFiles(data.path)
         data.cursor = 0
      }
   }

   if (key === 'right') {
      try {

         var isDir = fs.lstatSync(data.path + '/' + data.files[data.cursor].name).isDirectory()
         if (isDir) {
            data.path += '/' + data.files[data.cursor].name
         }
         data.files = getFiles(data.path)
         data.cursor = 0
      } catch (e) {}
   }

   if (key === 'space') {
      var fileAtCursor = data.files[data.cursor]
      var isSelected = data.selected.find(f => matchFiles(f, fileAtCursor))

      if (isSelected) {
         data.selected = data.selected.filter(f => !matchFiles(f, fileAtCursor))
      } else {
         fileAtCursor.name && data.selected.push({ ...fileAtCursor })
      }
   }

   if (key === 'return') {
      if (data.page == 'confirm') {
         // move em!!
         if (data.confirm) moveSelectedFiles()
         exitUi()
      } else {
         data.page = 'confirm'
         data.confirm = true
      }

   }

   render()
})

initialize(() => {
   
   render()
})



function render() {
   // clear
   clearUi()

   // write out info
   var maxLen = renderWidth - 'Path '.length - 5
   var currentLocationTrunc = data.path.length > maxLen 
      ? '...' + data.path.slice(data.path.length - maxLen + 3, data.path.length)
      : data.path
   writeLine('Path ' + currentLocationTrunc)
   writeLine('Selected: ' + (data.selected.length ? data.selected.map(f=>f.name) : 'Nothing!'))
   writeLine(new Array(renderWidth-2).fill('-').join(''))


   if (data.page === 'confirm') {
      // confirm page
      writeLine('Are you sure?')
      writeLine(`[${data.confirm ? 'x' : ' '}] yes`)
      writeLine(`[${!data.confirm ? 'x' : ' '}] no`)
   }


   if (data.page === 'select') {
      // file picker page
      var start = data.cursor - 3
      var end = data.cursor + 3

      var bottomOffAmount = start
      if (bottomOffAmount < 0) {
         start = 0
         end -= bottomOffAmount
      }

      var topOffAmount = end - data.files.length
      if (topOffAmount > 0) {
         end = data.files.length
         start -= topOffAmount
      }

      var start = Math.max(0, start)
      var end = Math.min(data.files.length, end)

      for (var i = start; i < end; i++) {
         var file = data.files[i]
         var icon = i == data.cursor ? '>' : ' '
         var checked = data.selected.find(f => matchFiles(f, file)) ? 'x' : ' '
         writeLine(`${icon} [${checked}] ${file.name}`)
      }

      if (!data.files.length) {
         writeLine('')
         writeLine('Empty')
      }
   }
}


function initialize(callBack) {
   // var interval = setInterval(() => {
   //    if (renderWidth > 0 && renderHeight > 0) {
   //       clearInterval(interval)
   //    }
   // })

   rl.write('\u001B[?25l');

   for (var i = 0; i < renderHeight; i++) {
      writeLine(i)
   }  

   clearUi()
   callBack()
   // getSize()
}

function exitUi() {
   rl.write('\u001B[?25h')
   process.exit()
}

function writeLine(text = '') {
   text = text.toString()
   if (text.length > renderWidth) {
      text = text.slice(0, renderWidth - 3) + '...'
   }
   console.log(' ' + text)
   writtenLines += 1
}

function clearUi() {
   if (!writtenLines) return
   readline.moveCursor(process.stdin, -100000, (writtenLines)*-1)
   readline.clearScreenDown(process.stdin)
   writtenLines = 0
}



//-----------------------------------------------------------
// Keyboard Listening
//-----------------------------------------------------------
function listenForKeyPress(callBack) {
   readline.emitKeypressEvents(process.stdin)
   process.stdin.setRawMode(true)
   process.stdin.on('keypress', (str, key) => {

      // console.log(key.name)
      if (key.name === 'return') {
         writtenLines += 1
      }

      var shouldExit = (key.ctrl && key.name === 'c') || key.name == 'escape'
      if (shouldExit) {
         exitUi()
      } else {
         // console.log('pressed: ' + key.name)
         callBack(key.name)
      }
   });
}


//-----------------------------------------------------------
// Resizing / Terminal
//-----------------------------------------------------------
// function listenForResize(callBack) {
//    process.on('SIGWINCH', callBack)
// }

function getSize() {
   exec('tput cols', (err, stdout, stderr) => {
      renderWidth = Number(stdout)
      console.log(`width: ${stdout}`);
   })

   exec('tput lines', (err, stdout, stderr) => {
      renderHeight = Number(stdout)
      console.log(`height: ${stdout}`);
   })
}