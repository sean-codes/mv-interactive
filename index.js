#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
process.stdin.setRawMode(true)
// outputs path on no chang exit to files MVI_MOVE_PATH.txt and MVI_MOVE_FROM.txt
// can use this for an interactive cd command. from my understanding you can not pass
// data outside an interactive nodejs promt in a clean way :(
var isExperimentalCDWriteMode = process.argv.includes('-cd') 

var DIRECTORY = process.cwd()

var renderHeight = 0
var renderWidth = 0//process.stdout.columns
var writtenLines = 0


// console.log('[navigate=arrow keys | select=spacebar | confirm=return | escape=esc]')
// console.log('')

var ACTIONS = {
   move: 'move',
   copy: 'copy',
   delete: 'delete',
   cancel: 'cancel',
}

var data = {
   path: DIRECTORY,
   cursor: 0,
   files: getFiles(DIRECTORY),
   selected: [],
   page: 'select',
   confirm: 0,
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

function moveSelectedFiles(action) {
   var isSafeMove = true // only a basic check. not really safe :>

   if (action !== ACTIONS.delete) {
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
   }


   if (isSafeMove) {
      for (var file of data.selected) {
         var oldPath = path.join(file.path, file.name)
         var newPath = path.join(data.path, file.name)
         // console.log('Moving', oldPath, 'to', newPath)
         if (action === ACTIONS.copy) 
            fs.copyFileSync(oldPath, newPath)
         if (action === ACTIONS.move) 
            fs.renameSync(oldPath, newPath)
         if (action === ACTIONS.delete) 
            fs.unlinkSync(oldPath)
      }
   }
}

listenForKeyPress((key) => {
   if (key === 'up') {
      data.cursor = Math.max(0, data.cursor - 1)
      data.confirm = Math.max(data.confirm - 1, 0)
   }
   if (key === 'down') {
      data.cursor = Math.min(data.files.length-1, data.cursor + 1)
      data.confirm = Math.min(Object.keys(ACTIONS).length-1, data.confirm + 1)
   }

   if ('qwertyuiopasdfghjklzxcvbnm'.split('').includes(key)) {
      initCursor(key)
   }

   // move path back 1
   if (key === 'left') {
      if (data.page == 'confirm') {
         data.page = 'select'
      } else {
         var newPath = data.path.split('/')
         var lastPath = newPath.pop()
         data.path = newPath.length > 1 ? newPath.join('/') : '/'
         data.files = getFiles(data.path)

         initCursor(lastPath)
      }
   }

   if (key === 'right') {
      try {
         var targetPath = path.join(data.path, data.files[data.cursor].name)
         var isDir = fs.lstatSync(targetPath).isDirectory()
         if (isDir) {
            data.path = targetPath
         }
         data.files = getFiles(data.path)
         initCursor()         
      } catch (e) {}
   }

   if (key === 'space' && !isExperimentalCDWriteMode) {
      var fileAtCursor = data.files[data.cursor]
      var isSelected = data.selected.find(f => matchFiles(f, fileAtCursor))

      if (isSelected) {
         data.selected = data.selected.filter(f => !matchFiles(f, fileAtCursor))
      } else {
         fileAtCursor.name && data.selected.push({ ...fileAtCursor })
      }
   }

   if (key === 'return') {
      const onSelectAndNoSelect = data.page == 'select' && data.selected.length == 0
      if (onSelectAndNoSelect) {
         if (isExperimentalCDWriteMode) {
            fs.writeFileSync('/tmp/mvi_move_from.txt', path.join(DIRECTORY))
            fs.writeFileSync('/tmp/mvi_move_to.txt', data.path)
         }
         
         exitUi(0)
      } else if (data.page == 'confirm') {
         // move em!!
         moveSelectedFiles(ACTIONS[Object.keys(ACTIONS)[data.confirm]])
         exitUi(0)
      } else {
         data.page = 'confirm'
         data.confirm = 0
      }

   }

   render()
})

initialize(() => {
   initCursor()
   render()
})

function initCursor(lastFile = null) {
   data.cursor = 0
   for (var i in data.files) {
      var fileName = data.files[i].name
      if (!lastFile && fileName.startsWith('.')) 
         data.cursor = Number(i) + 1

      if (fileName.toLowerCase().startsWith(lastFile)) {
         data.cursor = Number(i)
         break
      }
   }

   data.cursor = Math.min(data.files.length, data.cursor)
}

function render() {
   // clear
   clearUi()
   
   // write out info
   var maxLen = renderWidth - 'Path '.length - 5
   var currentLocationTrunc = data.path.length > maxLen 
      ? '...' + data.path.slice(data.path.length - maxLen + 3, data.path.length)
      : data.path
   writeLine('Path ' + currentLocationTrunc)
   !isExperimentalCDWriteMode && writeLine('Selected: ' + (data.selected.length ? data.selected.map(f=>f.name) : 'Nothing!'))
   writeLine(new Array(renderWidth-2).fill('-').join(''))


   if (data.page === 'confirm') {
      // confirm page
      writeLine('Are you sure?')
      writeLine(`[${data.confirm == 0 ? 'x' : ' '}] move`)
      writeLine(`[${data.confirm == 1 ? 'x' : ' '}] copy`)
      writeLine(`[${data.confirm == 2 ? 'x' : ' '}] delete`)
      writeLine(`[${data.confirm == 3 ? 'x' : ' '}] cancel`)
   }


   if (data.page === 'select') {
      // file picker page
      // todo: use linesLeft to calculate
      var start = data.cursor - 3
      var end = data.cursor + 3

      var bottomOffAmount = start
      if (bottomOffAmount < 0) {
         start = 0
         end = end - bottomOffAmount
      }

      var topOffAmount = end - data.files.length
      if (topOffAmount > 0) {
         end = data.files.length
         start -= topOffAmount
      }

      var start = Math.max(0, start)
      var end = Math.min(data.files.length, end)

      // writeLine('start: ' + start + ' end: ' + end)
      for (var i = start; i < end; i++) {
         var file = data.files[i]
         var icon = i == data.cursor ? '>' : ' '
         var checked = data.selected.find(f => matchFiles(f, file)) ? 'x' : ' '
         var checkedDisplay = isExperimentalCDWriteMode ? '' : `[${checked}]`
         writeLine(`${icon} ${checkedDisplay} ${file.name}`)
      }

      if (!data.files.length) {
         writeLine('')
         writeLine('Empty')
      }
   }
}

function initialize(callBack) {
   var interval = setInterval(() => {
      if (renderWidth > 0 && renderHeight > 0) {
         clearInterval(interval)
         
         console.log('\u001B[?25l');
         for (var i = 0; i < renderHeight; i++) {
            writeLine('')
         }

         callBack()
      }
   })




   getSize()
   // process.on('exit', () => {
   //    exitUi(2)
   // })
}

function exitUi(code = 2) {
   console.log('')
   rl.write('\u001B[?25h')
   // process.stderr.write('No')
   process.stdout.cursorTo(0)
   process.exit(code)
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
   // if (!writtenLines) return
   // readline.moveCursor(process.stdin, -100000, (writtenLines)*-1)
   // readline.clearScreenDown(process.stdin)
   // writtenLines = 0
   readline.moveCursor(process.stdout, -100000, -writtenLines)
   readline.clearScreenDown(process.stdout)

   // clear
   // for (var i = 0; i < renderHeight; i++) {
   //    console.log('clear ' + i)
   // }

   // readline.moveCursor(process.stdout, -100000, -renderHeight)
   // readline.clearScreenDown(process.stdout)
   
   writtenLines = 0
}

//-----------------------------------------------------------
// Keyboard Listening
//-----------------------------------------------------------
function listenForKeyPress(callBack) {
   readline.emitKeypressEvents(process.stdin)
   
   process.stdin.on('keypress', (str, key) => {

      // console.log(key.name)
      if (key.name === 'return') {
         writtenLines += 1
      }

      var shouldExit = (key.ctrl && key.name === 'c') || key.name == 'escape'
      if (shouldExit) {
         exitUi(2)
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

      renderWidth = process.stdout.columns - 5
      // console.log(`width: ${renderWidth}`);
   })

   exec('tput lines', (err, stdout, stderr) => {
      // need a clear way for this. doesnt work in some terminals :(
      renderHeight = 10
      // renderHeight = process.stdout.rows - 2
      // renderHeight = Math.max(process.stdout.rows-2, 10)
      // renderHeight = Math.max(Number(stdout)-2, 10)
      // console.log(`height: ${renderHeight}`);
   })
}