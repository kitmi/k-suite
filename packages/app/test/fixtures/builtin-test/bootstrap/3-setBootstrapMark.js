module.exports = async function (app) {    
    return new Promise((resolve) => {
        setTimeout(() => {            
            app.bootstrapInfo = 'for test only';
            resolve();
        }, 100);
    });    
};