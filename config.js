const REGISTER_CATNETWORK_PING = 1;
const REGISTER_CATMOVE = 2;
const REGISTER_CATCAM = 3;
const REGISTER_DEVICE_ID = 4;
module.exports = {
    //注册事件编号定义
    REGISTER_CATNETWORK_PING,       //ping事件
    REGISTER_CATMOVE,               //电机马达事件
    REGISTER_CATCAM,                //摄像头事件
    REGISTER_DEVICE_ID,             //设备注册事件

    //消息类型定义
    MESSAGE_TYPE_JSON: 0,  // 传输数据类型:JSON
    MESSAGE_TYPE_JPEG: 1,  // 传输数据类型:JPEG

    BOUNDARY: "cat123456789", //传输图片流用的BOUNDARY


    rt: {    //实时动态配置
        MaxCacheFrame: 2,    //网络缓存帧数
        format: "avif",    //图片传输格式
    }

}
