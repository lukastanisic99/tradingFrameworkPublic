import { Spot } from '@binance/connector';
import WebSocketUtils, { WebSocketCallbacks } from '../../util/WebSocketUtils';
import { WebSocket } from 'ws';
import Order, { Commission, Filled, OrderSide, OrderStatus, OrderType } from '../../Order';
import OrderBook from '../../OrderBook';
import Exchange from '../Exchange';
import Request, { RequestConfig } from '../../util/networking/Request';
import { ExchnageInfo, SymbolTradeFee } from './Types';

class Binance extends Exchange {
    private apiKey: string;
    private apiSecret: string;
    private listenKey: string;
    private userStream: WebSocket;
    private exchangeInfo: ExchnageInfo; // binance exchnageInfo response - '/api/v3/exchangeInfo'
    private symbolTradeFees: SymbolTradeFee[];
    public client;
    protected static instance: Binance;
    private initilized: boolean = false;
    private isTest = false;

    private constructor() {
        super(Binance.name);
        if (process.env.IS_TEST && (!process.env.BINANCE_API_KEY_TEST || !process.env.BINANCE_API_KEY_SECRET_TEST)) throw new Error('Binance keys not defined');
        else if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_KEY_SECRET) throw new Error('Binance keys not defined');
        this.isTest = false;
        if (process.env.IS_TEST) this.isTest = true;
        this.apiKey = this.isTest ? process.env.BINANCE_API_KEY_TEST : process.env.BINANCE_API_KEY;
        this.apiSecret = this.isTest ? process.env.BINANCE_API_KEY_SECRET_TEST : process.env.BINANCE_API_KEY_SECRET;
        this.client = this.isTest
            ? new Spot(this.apiKey, this.apiSecret, {
                  baseURL: 'https://testnet.binance.vision',
                  wsURL: 'wss://testnet.binance.vision',
              })
            : new Spot(this.apiKey, this.apiSecret);
    }
    public static async initAsync(): Promise<void> {
        if (Binance.instance) return;
        Binance.instance = new Binance();
        try {
            //Open socket for USER_STREAM
            Binance.instance.subscribeUserData();
            setInterval(() => {
                Binance.instance.subscribeUserData();
                console.log('Renew ListenKey');
            }, 1000 * 60 * 30); //30min

            //Load account balances - snapshot
            let res = await Binance.instance.client.signRequest('GET', '/api/v3/account', {});
            for (let b of res.data.balances) {
                let asset = Binance.instance.tickersJSON.assetMapping[b.asset];
                if (asset) {
                    let balance = Binance.instance.account.getBalance(asset);
                    balance.setAvailable(parseFloat(b.free));
                    balance.setLocked(parseFloat(b.locked));
                }
            }
            let data = await Binance.instance.client.publicRequest('GET', '/api/v3/exchangeInfo', {});
            Binance.instance.exchangeInfo = new ExchnageInfo();
            for (let s of data.data.symbols) {
                let symbolInfo = Binance.instance.exchangeInfo.setSymbolInfo(s.symbol, s);
            }
            if (!Binance.instance.isTest) Binance.instance.symbolTradeFees = (await Binance.instance.signRequest('GET', '/sapi/v1/asset/tradeFee')).data;
            await Binance.instance.initOrdersAsync();
            Binance.instance.initilized = true;
        } catch (e) {
            console.log(e);
        }
        return;
    }
    public static getInstance(): Binance {
        if (Binance.instance && Binance.instance.initilized) return Binance.instance;
        throw new Error('Binance not initilized!');
    }
    private subscribeUserData() {
        // if (process.env.IS_TEST) return;
        this.getListenKey().then((listenKey: string) => {
            if (this.listenKey != listenKey) {
                this.listenKey = listenKey;
                let callbacks = new WebSocketCallbacks();
                callbacks.message = this.userStreamOnMessage.bind(this);
                if (this.userStream) this.userStream.close();
                this.userStream = process.env.IS_TEST
                    ? WebSocketUtils.subscribeSocket(`wss://testnet.binance.vision/ws/${this.listenKey}`, callbacks)
                    : WebSocketUtils.subscribeSocket(`wss://stream.binance.com:9443/ws/${this.listenKey}`, callbacks);
            }
        });
    }

    private userStreamOnMessage(data: string) {
        let response = JSON.parse(data);
        switch (response.e) {
            case 'executionReport':
                console.log(response);
                let order = this.orderMap.get(response.i.toString()); //id
                if (!order) return this.trackUntrackedOrder(response);
                if (order.lastUpdateTime == response.T) return; //order update already proccesed on execute order
                let status = this.getOrderStatus(response.X); //status
                let lastPrice = parseFloat(response.L); //last price
                let lastAmount = parseFloat(response.l); //last executed quantity
                let commission = parseFloat(response.n); //commission
                let comissionsAsset = this.tickersJSON.assetMapping[response.N ? response.N : 'BNB']; //commissionAsset
                order.update(status, lastAmount ? [new Filled(lastAmount, lastPrice, [new Commission(comissionsAsset, commission)])] : []);
                break;

            default:
                break;
        }
        console.log(data);
    }
    private async getListenKey(): Promise<string> {
        let response = await this.client.publicRequest('POST', '/api/v3/userDataStream', {});
        // console.log(response);
        return response.data.listenKey;
    }
    private getOrderType(order: Order): string {
        switch (order.type) {
            case OrderType.MARKET:
                return 'MARKET';
            case OrderType.LIMIT:
                return 'LIMIT';
            case OrderType.LIMIT_MAKER:
                return 'LIMIT_MAKER';

            default:
                return 'LIMIT';
        }
    }
    private getTimeInForce(order: Order): string {
        switch (order.type) {
            case OrderType.LIMIT_IOC:
                return 'IOC';
            case OrderType.LIMIT_MAKER:
                return undefined;
            default:
                return 'GTC';
        }
    }
    protected async _executeOrderAsync(order: Order): Promise<boolean> {
        let side = order.side == OrderSide.BUY ? 'BUY' : 'SELL';
        let type = this.getOrderType(order);
        let timeInForce = this.getTimeInForce(order);
        let response = await this.client.newOrder(order.symbol.toUpperCase(), side, type, {
            // price: '280',
            price: order.price,
            quantity: order.amount,
            timeInForce: timeInForce,
            timestamp: new Date().getMilliseconds(),
            newOrderRespType: 'FULL',
        });
        //Manage order
        let status: OrderStatus;
        let fills: Filled[] = [];
        if (response.status != 200) {
            status = OrderStatus.CANCELLED;
            order.update(status);
            console.error(response.statusText);
            return false;
        }
        //Update the Order
        status = this.getOrderStatus(response.data.status);
        order.lastUpdateTime = response.data.transactTime;
        if (response.data.fills && response.data.fills.length > 0) {
            let price, amount, commission, commissionAsset;
            for (let fill of response.data.fills) {
                price = parseFloat(fill.price);
                amount = parseFloat(fill.qty);
                commission = parseFloat(fill.commission);
                commissionAsset = fill.commissionAsset;
                fills.push(new Filled(amount, price, [new Commission(commissionAsset, commission)]));
            }
        }
        order.orderId = response.data.orderId.toString();
        this.orderMap.set(order.orderId, order);
        order.update(status, fills);

        return true;
    }

    public async cancelOrderAsync(order: Order): Promise<boolean> {
        let cancel = async () => {
            let res = await this.client.cancelOrder(order.symbol, { orderId: order.orderId, recvWindow: 10000 });
            order.update(OrderStatus.CANCELLED);
            return res;
        };
        while (true) {
            try {
                await cancel();
                break;
            } catch (e) {
                console.log(e);
                if (e.response.data.code == -1021) {
                    continue;
                }
                return false;
            }
        }
        return true;
    }

    public observe(pair: string): OrderBook {
        try {
            let orderBook = this.orderBookMap.get(pair);
            if (orderBook) return orderBook;
            orderBook = new OrderBook(pair, this); //need to identify it somehow
            this.orderBookMap.set(pair, orderBook);
            let processedSnapshot = false;
            let snapshotRequestSent = false;
            let socketQueue = [];
            let symbol = this.tickersJSON.pairs[pair].exchangePair;
            if (!this.isTest) {
                for (let s of this.symbolTradeFees) {
                    if (s.symbol == symbol) {
                        orderBook.setMakerFee(parseFloat(s.makerCommission));
                        orderBook.setTakerFee(parseFloat(s.takerCommission));
                    }
                }
            } else {
                orderBook.setMakerFee(0.001);
                orderBook.setTakerFee(0.001);
            }

            let processSocketData = (data) => {
                //update asks
                for (let ask of data.a as any[]) {
                    let price = parseFloat(ask[0]);
                    let amount = parseFloat(ask[1]);
                    orderBook.updateAsks(price, amount);
                }

                //update bids
                for (let bid of data.b as any[]) {
                    let price = parseFloat(bid[0]);
                    let amount = parseFloat(bid[1]);
                    orderBook.updateBids(price, amount);
                }
            };
            let snapshotRequest = () => {
                this.client
                    .depth(symbol, { limit: 100 })
                    .then((response) => {
                        let data = response.data;
                        //update asks
                        for (let ask of data.asks as any[]) {
                            let price = parseFloat(ask[0]);
                            let amount = parseFloat(ask[1]);
                            orderBook.updateAsks(price, amount);
                        }

                        //update bids
                        for (let bid of data.bids as any[]) {
                            let price = parseFloat(bid[0]);
                            let amount = parseFloat(bid[1]);
                            orderBook.updateBids(price, amount);
                        }
                        for (let socketData of socketQueue) {
                            if (socketData.U <= data.lastUpdateId + 1 && socketData.u >= data.lastUpdateId + 1) processSocketData(socketData);
                        }
                        socketQueue = [];
                        processedSnapshot = true;
                        orderBook.setIsReady(true);
                        orderBook.notifyAll();
                    })
                    .catch((e) => {
                        console.log(e);
                        snapshotRequestSent = false;
                    });
                snapshotRequestSent = true;
            };
            let callbacks = {
                open: () => {
                    console.log('Connected with Websocket server');
                    processedSnapshot = false;
                    snapshotRequestSent = false;
                    socketQueue = [];
                    orderBook.setIsReady(false);
                },
                close: () => console.log('Disconnected with Websocket server'),
                message: (data) => {
                    //do something here
                    data = JSON.parse(data);
                    if (!snapshotRequestSent) snapshotRequest();
                    if (!processedSnapshot) {
                        socketQueue.push(data);
                        return;
                    }
                    processSocketData(data);
                    orderBook.notifyAll();
                },
            };
            this.client.diffBookDepth(pair, '100ms', callbacks);
            return orderBook;
        } catch (e) {
            console.log(e);
        }
    }

    private getOrderStatus(status: string) {
        switch (status) {
            case 'NEW':
                return OrderStatus.NEW;
                break;
            case 'PARTIALLY_FILLED':
                return OrderStatus.PARTIALLY_FILLED;
                break;
            case 'FILLED':
                return OrderStatus.EXECUTED;
                break;
            case 'CANCELED':
                return OrderStatus.CANCELLED;
                break;
            case 'REJECTED':
                return OrderStatus.CANCELLED;
                break;
            case 'EXPIRED':
                return OrderStatus.CANCELLED;
                break;
            default:
                break;
        }
    }

    public applyFilters(order: Order): Order {
        let symbol = this.tickersJSON.pairs[order.symbol].exchangePair;
        try {
            //PRICE FILTER
            let binancePriceFilter: any = this.exchangeInfo.getSymbolInfo(symbol).getFilter('PRICE_FILTER');
            let tickSize = parseFloat(binancePriceFilter.tickSize);
            let minPrice = parseFloat(binancePriceFilter.minPrice);
            let maxPrice = parseFloat(binancePriceFilter.maxPrice);
            let x = 1 / tickSize;
            order.price = Math.floor(order.price * x) / x;
            if (order.price > maxPrice || order.price < minPrice) return null;
            //LOT_SIZE
            let binanceLotSizeFilter: any = this.exchangeInfo.getSymbolInfo(symbol).getFilter('LOT_SIZE');
            let stepSize = parseFloat(binanceLotSizeFilter.stepSize);
            let minAmount = parseFloat(binanceLotSizeFilter.minQty);
            let maxAmount = parseFloat(binanceLotSizeFilter.maxQty);
            x = 1 / stepSize;
            order.amount = Math.floor(order.amount * x) / x;
            if (order.amount > maxAmount || order.amount < minAmount) return null;
            //MIN_NOTIONAL
            let binanceMinNotionalFilter: any = this.exchangeInfo.getSymbolInfo(symbol).getFilter('MIN_NOTIONAL');
            let minNotional = parseFloat(binanceMinNotionalFilter.minNotional);
            if (order.price * order.amount < minNotional) return null;
            //OTHER FILTERS
            //.
            //.
            //.
            return order;
        } catch (e) {
            return null;
        }
    }

    /**
     * to track orders created outside this system AFTER the system is started and synced - the initial sync for orders on start is done by another method
     * NOTE: in rare cases this may fail when race condition between a new order created by this system and a new order created by another system cumulatively want to spend more than the available amount of funds - DOUBLE SPEND
        https://binance-docs.github.io/apidocs/spot/en/#payload-order-update
    */
    private trackUntrackedOrder(jsonResponse) {
        let symbol = jsonResponse.s;
        let price = parseFloat(jsonResponse.p);
        let amount = parseFloat(jsonResponse.q);
        let side = jsonResponse.S == 'BUY' ? OrderSide.BUY : OrderSide.SELL;
        let type = jsonResponse.o == 'MARKET' ? OrderType.MARKET : OrderType.LIMIT;
        let exchange = this;
        let updateClosue = (_this: Order) => {};
        //create the order as it was created by this system
        let o = Order.createOrder(symbol, price, amount, side, type, exchange, updateClosue);

        //map it
        let orderId: string = jsonResponse.i.toString();
        this.orderMap.set(orderId, o);

        //apply updates
        let status = this.getOrderStatus(jsonResponse.X);
        let cumulativeQuoteAssetAmount = parseFloat(jsonResponse.Z); // quote asset - bnbusdt -> usdt is quote asset
        let filledBaseAssetFilledAmount = parseFloat(jsonResponse.z); // base asset - bnbusdt -> bnb
        let averagePrice = filledBaseAssetFilledAmount ? cumulativeQuoteAssetAmount / filledBaseAssetFilledAmount : 0;
        let commission = parseFloat(jsonResponse.n); //commission
        let comissionsAsset = this.tickersJSON.assetMapping[jsonResponse.N ? jsonResponse.N : 'BNB']; //commissionAsset
        o && o.update(status, [new Filled(filledBaseAssetFilledAmount, averagePrice, [new Commission(comissionsAsset, commission)])]);
    }

    private async initOrdersAsync() {
        let response = await this.client.openOrders();
        let ordersArray = response.data;
        for (let order of ordersArray) {
            let symbol = order.symbol;
            let price = parseFloat(order.price);
            let amount = parseFloat(order.origQty);
            let side = order.side == 'BUY' ? OrderSide.BUY : OrderSide.SELL;
            let type = order.type == 'MARKET' ? OrderType.MARKET : OrderType.LIMIT;
            let exchange = this;
            let updateClousre = (_this: Order) => {};

            //create the order
            let o = Order.createOrder(symbol, price, amount, side, type, exchange, updateClousre, false);

            //map it
            let orderId: string = order.orderId.toString();
            this.orderMap.set(orderId, o);

            //apply updates
            let status = this.getOrderStatus(order.status);
            let cumulativeQuoteAssetAmount = parseFloat(order.cummulativeQuoteQty); // quote asset - bnbusdt -> usdt is quote asset
            let filledBaseAssetFilledAmount = parseFloat(order.executedQty); // base asset - bnbusdt -> bnb
            let averagePrice = filledBaseAssetFilledAmount ? cumulativeQuoteAssetAmount / filledBaseAssetFilledAmount : 0;
            //update order without triggering Account updates -> since the account snapshot already contains the correct state till this point
            o.status = status;
            if (filledBaseAssetFilledAmount) o.filled.push(new Filled(filledBaseAssetFilledAmount, averagePrice, []));
        }
    }

    public async signRequest(method: string, path: string, params = {}, config: RequestConfig = {}): Promise<any> {
        if (!params['timestamp']) {
            const timestamp = Date.now();
            params['timestamp'] = timestamp;
        }
        return await Request.signRequest(method, this.client.baseURL, path, this.apiKey, this.apiSecret, params, config);
    }
}

export default Binance;
