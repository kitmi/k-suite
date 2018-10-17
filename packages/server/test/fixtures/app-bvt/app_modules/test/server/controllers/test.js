"use strict";

const { http} = require('../../../../../../../lib');

async function middleware1(ctx, next) {    
    ctx.state1 = 'Hello';
    return next();
}

module.exports = {
    action1: http('get')(
        async (ctx) => {
            ctx.body = 'action1';
        }
    ),

    post: http('post:/action1')(
        async (ctx) => {
            ctx.body = 'you post: ' + ctx.request.body.name;
        }
    ),

    action2: http('get', middleware1)(async ctx => {
        ctx.body = ctx.state1;
    })
};
