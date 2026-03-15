const fs = require('fs')
const path = require('path')
const { createCanvas } = require('canvas')

const iconsDir = path.join(__dirname, 'cha-cha-front', 'assets', 'icons')

function createIcon(filename, iconType, color) {
  const size = 81
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  
  const center = size / 2
  
  if (iconType === 'home') {
    ctx.beginPath()
    ctx.moveTo(center, 15)
    ctx.lineTo(65, 35)
    ctx.lineTo(65, 66)
    ctx.lineTo(16, 66)
    ctx.lineTo(16, 35)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.rect(30, 45, 20, 21)
    ctx.stroke()
  } else if (iconType === 'query') {
    ctx.beginPath()
    ctx.arc(center, center - 5, 20, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(center + 14, center + 10)
    ctx.lineTo(center + 25, center + 25)
    ctx.stroke()
  } else if (iconType === 'user') {
    ctx.beginPath()
    ctx.arc(center, 28, 15, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(center, 75, 30, Math.PI, 0, true)
    ctx.stroke()
  }
  
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(iconsDir, filename), buffer)
  console.log(`Created: ${filename}`)
}

try {
  createIcon('home.png', 'home', '#999999')
  createIcon('home-active.png', 'home', '#07c160')
  createIcon('query.png', 'query', '#999999')
  createIcon('query-active.png', 'query', '#07c160')
  createIcon('user.png', 'user', '#999999')
  createIcon('user-active.png', 'user', '#07c160')
  console.log('All icons created!')
} catch (e) {
  console.log('canvas module not available, using alternative method')
}
