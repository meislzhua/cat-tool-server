const AV = require('leancloud-storage')
const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const sharp = require('sharp');

const koaBody = require('koa-body');
const CatNetwork = require('./CatNetwork');
const _ = require('lodash');
const config = require('../config');

//======================== 路由处理 ========================
const router = new Router();

const checkToken = async (ctx, next) => {
    let token = ctx.query.token || ctx.request.body.token;
    ctx.checkToken = await CatServer.checkToken(token)
    next();
}
let MaxCacheFrame = 2;
//请求图片流处理
router.get("/img", checkToken, ctx => {
    if (!ctx.checkToken) return;
    let s = new require('stream').Duplex();
    s._read = () => null;
    s._write = async function (chunk, enc, done) {
        if (chunk.length * MaxCacheFrame > this.readableLength) this.push(
            await sharp(chunk)
                .avif()
                .toBuffer()
        );
        done();
    };
    CatNetwork.imageSteam.pipe(s);
    ctx.status = 200;
    ctx.response.set("content-type", `multipart/x-mixed-replace; boundary="${config.BOUNDARY}"`)
    ctx.body = s;
})

//请求命令处理
router.get("/cmd", checkToken, ctx => {
    if (!ctx.checkToken) return;
    let param = {...ctx.query, ...ctx.request.body};
    let data = _.omit(param, ["token", "target"]);
    const target = param.target && CatNetwork.targetMap[param.target];

    if (target) CatNetwork.sendJson(target.socket, data)
    else CatNetwork.socketMap.forEach(({socket}) => CatNetwork.sendJson(socket, data));


    ctx.status = 200;

})

//======================== CatServer ========================
class CatServer {
    static tokenCache = {};

    /**
     * 在leancloud中检测token
     */
    static async checkToken(token) {
        if (!token) return false;
        if (CatServer.tokenCache[token]) return true;
        const res = !!await (new AV.Query('UserToken')).get(token).catch(err => null);
        if (res && CatServer.tokenCache[token]) {
            if (CatServer.tokenCache[token]) clearTimeout(CatServer.tokenCache[token]);
            CatServer.tokenCache[token] = setTimeout(() => delete CatServer.tokenCache[token], 30 * 1000)
        }

        return res;
    }

    static init() {

        AV.init({
            appId: 'gVUPfPAKALUGwHkVLRE03jG6-gzGzoHsz',
            appKey: 'xsr5DiTrVw8ur7CmfiAMnIOy',
            serverURL: "https://gvupfpak.lc-cn-n1-shared.com"
        });


        const app = new Koa();
        app.use(cors())
            .use(koaBody())
            .use(router.routes())
            .use(router.allowedMethods())
            .listen(8432);

    }
}

module.exports = CatServer;