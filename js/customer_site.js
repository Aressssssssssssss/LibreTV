const CUSTOMER_SITES = {
    qiqi: {
        api: 'https://www.qiqidys.com/api.php/provide/vod',
        name: '七七资源',
    },
    yingshigongchang:{
        api:'https://cj.lziapi.com/api.php/provide/vod/',
        name:'影视工厂',
    },
    fantuanyingshi:{
        api:'https://www.fantuan.tv/api.php/provide/vod/',
        name:'饭团影视',
    }
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
