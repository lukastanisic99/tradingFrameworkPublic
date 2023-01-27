import OrderBook from '../../OrderBook';
import Exchange from '../Exchange';
import { WSv2 } from 'bitfinex-api-node';
import WS from 'ws';
import { TextDecoder } from 'util';
import Order from '../../Order';

class Bitfinex extends Exchange {
    private apiKey = process.env.BITFINEX_API_KEY;
    private apiSecret = process.env.BITFINEX_API_KEY_SECRET;
    public client;

    private decoder = new TextDecoder('utf-8');

    protected static instance: Bitfinex;

    private constructor() {
        super(Bitfinex.name);
        this.initAsync();
    }

    protected initAsync(): Promise<void> {
        return;
    }
    public static getInstance(): Bitfinex {
        if (Bitfinex.instance) return Bitfinex.instance;
        return (Bitfinex.instance = new Bitfinex());
    }

    protected async _executeOrderAsync(order: Order): Promise<boolean> {
        try {
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    public async cancelOrderAsync(order: Order): Promise<boolean> {
        return true;
    }
    public observe(pair: string): OrderBook {
        try {
            let orderBook = this.orderBookMap.get(pair);
            if (orderBook) return orderBook;
            orderBook = new OrderBook(pair, this); //need to identify it somehow
            this.orderBookMap.set(pair, orderBook);
            let ws = new WS('wss://api-pub.bitfinex.com/ws/2');
            ws.on('message', (msg) => {
                let str = this.decoder.decode(msg as ArrayBuffer);
                let data = JSON.parse(str);
                if (!data['event']) {
                    let arr = data[1]; //this is an array
                    //snapshot
                    if (Array.isArray(arr[0])) {
                        for (let i = 0; i < arr.length / 2; i++) {
                            let bid = arr[i] as any[]; //[price,count,amount]
                            orderBook.updateBids(bid[0], bid[2]);
                        }
                        for (let i = arr.length / 2; i < arr.length; i++) {
                            let ask = arr[i] as any[]; //[price,count,amount]
                            orderBook.updateAsks(ask[0], ask[2]);
                        }
                    }
                    //update
                    else {
                        // arr = [price,count,amount];
                        let price = arr[0];
                        let count = arr[1];
                        let amount = arr[2];
                        //update price level
                        if (count > 0) {
                            //update bids
                            if (amount > 0) {
                                orderBook.updateBids(price, amount);
                            }
                            //update asks
                            else {
                                orderBook.updateAsks(price, -amount);
                            }
                        }
                        //delete level
                        if (count == 0) {
                            //delete from bids
                            if (amount == 1) {
                                orderBook.updateBids(price, 0);
                            }
                            //delete from asks
                            else {
                                orderBook.updateAsks(price, 0);
                            }
                        }
                    }
                    // orederBook.printFirst();
                    orderBook.notifyAll();
                }
                // console.log(data)
            });

            let msg = JSON.stringify({
                event: 'subscribe',
                channel: 'book',
                symbol: pair,
                prec: 'P0',
                freq: 'F0',
                len: '25',
                subId: 123,
            });
            ws.on('open', () => ws.send(msg));
            return orderBook;
        } catch (e) {
            console.log(e);
        }
    }
    public applyFilters(order: Order): Order {
        return order;
    }
}

export default Bitfinex;
