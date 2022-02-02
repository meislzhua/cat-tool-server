const net = require('net');
const {Stick, MaxBodyLen} = require('@lvgithub/stick');
const config = require("../config");
const sharp = require("sharp");
const stream = require("stream");

module.exports = class CatNetwork {
    static socketId = 0;
    static port = 8431;
    static server = null;

    static socketMap = new Map();
    static targetMap = {};
    static streamInfo = {
        deviceCount: 0,
        isCoding: false,
    }
    static imageSteam = new require('stream').Duplex({
        read() {
        },
        write(chunk, enc, done) {
            if (!config.rt.isFormat) {
                this.push(Buffer.concat([
                    new Buffer(`--${config.BOUNDARY}\r\nContent-Type: image/jpeg\r\n\r\n`),
                    chunk
                ]));
                done();
                return;
            }

            if (CatNetwork.streamInfo.deviceCount) {
                if (CatNetwork.streamInfo.isCoding) {
                    CatNetwork.streamInfo.next = chunk;
                    console.log("正在coding,放入next:");
                    return done?.();
                }
                CatNetwork.streamInfo.isCoding = true;
                CatNetwork.streamInfo.next = null;
                (async () => {
                    let start = Date.now();
                    const image = sharp(chunk).toFormat(config.rt.format, config.rt.formatOption);
                    let data = Buffer.concat([
                        new Buffer(`--${config.BOUNDARY}\r\nContent-Type: image/${(await image.metadata()).format}\r\n\r\n`),
                        await image.toBuffer()
                    ])
                    this.push(data)
                    CatNetwork.streamInfo.isCoding = false;
                    console.log("转化耗时:", Date.now() - start, "长度:", data.length);
                    if (CatNetwork.streamInfo.next) this.write(this.next);
                })().catch(() => CatNetwork.streamInfo.isCoding = false);
            }

            done?.();
        }
    });

    static lastImageTime = null;

    /**
     * 处理来自单片机的JSON信息
     */
    static onJson(sData, body) {
        console.log("接受到数据:", body);
        if (config.REGISTER_DEVICE_ID === body.c) {
            sData.name = body.n;
            if (CatNetwork.targetMap[sData.name]) CatNetwork.removeConnect(CatNetwork.targetMap[sData.name]);
            CatNetwork.targetMap[sData.name] = sData;
        }
    }

    /**
     * 处理来自单片机的图片信息
     */
    static onImage(sData, body) {

        console.log("接受到图片信息:", body.length, CatNetwork.lastImageTime && `帧间隔:${Date.now() - CatNetwork.lastImageTime}`);
        CatNetwork.lastImageTime = Date.now();
        CatNetwork.imageSteam.write(body);
    }

    /**
     * 发送(一行)信息 //todo: 修改采用stick
     */
    static send(socket, data) {
        socket.write(data.toString() + "\n");
    }

    /**
     * 发送JSON信息
     */
    static sendJson(socket, data) {

        CatNetwork.send(socket, JSON.stringify(data))
    }


    /**
     * 移除单片机连接
     */
    static removeConnect(sData) {
        if (sData.name) delete CatNetwork.targetMap[sData.name];
        sData.socket.destroy();
        CatNetwork.socketMap.delete(sData.socket);
    }


    static getImageStream() {
        CatNetwork.streamInfo.deviceCount++;

        if (CatNetwork.streamInfo.deviceCount) {
            CatNetwork.socketMap.forEach(({socket}) => {
                socket && CatNetwork.sendJson(socket, {c: config.REGISTER_CATCAM, o: 1});
            })
            console.log("自动打开摄像头！");
        }

        return CatNetwork.imageSteam;
    }

    static removeImageStream(stream) {
        CatNetwork.streamInfo.deviceCount--;

        if (!CatNetwork.streamInfo.deviceCount) {
            CatNetwork.socketMap.forEach(({socket}) => {
                socket && CatNetwork.sendJson(socket, {c: config.REGISTER_CATCAM, o: 0});
            })
            console.log("自动关闭摄像头！");
        }
    }

    static init() {
        if (CatNetwork.server) CatNetwork.server.close();
        CatNetwork.server = net.createServer(function (socket) {
            //socket连接处理

            let stick = new Stick(1024 * 1024);
            stick.setMaxBodyLen(MaxBodyLen['2048M']);

            //todo 抽象成对象
            let sData = {socket, stick, id: CatNetwork.socketId++};
            console.log(`客户端连接:${sData.id}`)


            socket.on('data', data => stick.putData(data));
            socket.on("end", () => CatNetwork.removeConnect(sData));
            socket.on("close", () => CatNetwork.removeConnect(sData));
            socket.on("error", () => CatNetwork.removeConnect(sData))

            //当socket接受到数据的时候,分发到响应的地方处理
            stick.onBody(body => {
                if (body[0] === config.MESSAGE_TYPE_JSON) CatNetwork.onJson(sData, JSON.parse(body.slice(1).toString()));
                if (body[0] === config.MESSAGE_TYPE_JPEG) CatNetwork.onImage(sData, body.slice(1));
            })

            CatNetwork.socketMap.set(socket, sData);


        });
        CatNetwork.imageSteam.pipe(new stream.Writable({
            write(chunk, encoding, callback) {
                callback?.();
            }
        }))
        CatNetwork.server.listen(8431, '0.0.0.0', () => console.log("服务器监听开始"));
    }


}
