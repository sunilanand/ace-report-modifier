const xmpReader = require('xmp-reader');

xmpReader.fromFile('./redSQ.jpg', (err, data) => {
    if (err) console.log(err);
    else console.log(data);
});