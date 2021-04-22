const fs = require("fs");


const sharp = require("sharp")



// let svg =fs.readFileSync('./reports/data/OPS/img/cards/7_lit_en_ese_u3_poster.svg');
//let svgData = `<?xml version="1.0" encoding="UTF-8"?>`
 

sharp('./reports/data/OPS/img/cards/7_lit_en_ese_u3_poster.svg')
  .png()
  .toFile("new-file.jpg")
  .then(function(info) {
    console.log(info)
  })
  .catch(function(err) {
    console.log(err)
  })