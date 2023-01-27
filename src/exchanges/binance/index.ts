import Binance from './Binance';

let main = async () => {
    await Binance.initAsync();
    let b = Binance.getInstance();
    let callbacks = {
        open: () => console.log('Connected with Websocket server'),
        close: () => console.log('Disconnected with Websocket server'),
        message: (data) => console.log(data),
    };
    try {
        let x = await b.client.depth('bnbusdt');
        console.log(x);
        let openOrder = await b.client.openOrders({
            symbol: 'BNBUSDT',
            timestamp: new Date().getMilliseconds(),
        });
        // let trade = await b.executeOrderAsync('bnbusdt',2);
        // let book = b.observe('iotausdt');
        let book2 = b.observe('bnbusdt');
    } catch (e) {
        console.log(e);
    }
};
main();
