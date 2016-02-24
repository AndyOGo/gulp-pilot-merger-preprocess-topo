var fs = require('fs');

module.exports = {
    rawinclude: function(path) {
        return fs.readFileSync(path);
    }
};