const xmpReader = require('xmp-reader');

xmpReader.fromFile('./5_ccaese963864_266p.jpg', (err, data) => {
    if (err) console.log(err);
    else console.log(data);
});