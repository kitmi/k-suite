'use strict';

const crypto = require('crypto');

function hashPassword(password, passwordSalt) {

    const hash = crypto.createHash('sha256');
    hash.update(password);
    hash.update(passwordSalt);

    return hash.digest('base64');
}

module.exports = hashPassword;