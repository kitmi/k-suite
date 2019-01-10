const { WebServer } = require('../../lib');

let startEnv = process.env.NODE_ENV || 'development';

const webServer = new WebServer('LEVO', startEnv === 'development' ? {
    logger: {
        level: 'debug'
    },
    logWithAppName: true
} : {});

webServer.start_().then(() => {
    // started to listen    
}).catch(error => {
    console.error(error);
    process.exit(1);
});