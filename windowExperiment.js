// experimental for getting width/height then clear/render without moving terminal
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const readline = require('node:readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
process.stdin.setRawMode(true)


var height = process.stdout.rows - 2
var cursorY = 0
var count = 0
clear()
render()
setInterval(() => {
   count += 1
   render()
}, 1000)

function render() {
   clear()

   // draw
   // write('count: ' + 1)
   for (var i = 0; i < height; i++) {
      write('count: ' + i + count)
   }
}

function write(line) {
   process.stdout.write(line)
   readline.moveCursor(process.stdout, -10000, 1)
   cursorY += 1
}

function clear() {
   // should just need this but it doesnt work for all terminals
   readline.moveCursor(process.stdout, -100000, -cursorY)
   readline.clearScreenDown(process.stdout)

   // clear
   for (var i = 0; i < height; i++) {
      console.log(i)
   }

   readline.moveCursor(process.stdout, -100000, -height)
   readline.clearScreenDown(process.stdout)
   
   cursorY = 0
}

// console.clear()