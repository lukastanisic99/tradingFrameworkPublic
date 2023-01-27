import Exchange from './exchanges/Exchange';
import { OrderSide, PrepareOrder, SimulateOrder } from './Order';
import Strategy from './Strategy';
import { Observable, Observer } from './util/Observer/Observer';
import { MaxRBIterator, MinRBIterator } from './util/RBTree/Iterator';
import RBTree, { Node } from './util/RBTree/RBTree';
import SafeMath from './util/SafeMath';

class MapQueue {
    private map: Map<number, [number, number][]> = new Map<number, [number, number][]>();

    public insert(price: number, amount: number) {
        let milliseconds = new Date().getTime() % 100000000;
        let array = this.map.get(price);
        if (!array) this.map.set(price, [[amount, milliseconds]]);
        else array.push([amount, milliseconds]);
    }
    public getQueue(price: number): [number, number][] {
        return this.map.get(price);
    }
}

class OrderBook extends Observable {
    protected observers: Strategy[];

    private symbol: string; //eg. btcusdt
    private asset1: string;
    private asset2: string;
    private asks: RBTree<number>;
    private askIterator: MinRBIterator<number>;
    private bids: RBTree<number>;
    private bidIterator: MaxRBIterator<number>;
    private makerFee: number;
    private takerFee: number;
    private exchange: Exchange;
    private isReady = false;
    // for testing
    // private testMapQueue = new MapQueue();

    /**
     *
     * @param symbol
     * @param exchange Exchange - a concrete object eg. Binance or Bitfinex...
     */
    constructor(symbol: string, exchange: Exchange) {
        super();
        this.symbol = symbol;
        this.asset1 = exchange.getTickersJSON().pairs[symbol].asset1;
        this.asset2 = exchange.getTickersJSON().pairs[symbol].asset2;
        this.asks = new RBTree<number>();
        this.askIterator = this.asks.getMinIterator();
        this.bids = new RBTree<number>();
        this.bidIterator = this.bids.getMaxIterator();
        this.exchange = exchange;
    }
    public getAsset1(): string {
        return this.asset1;
    }
    public getAsset2(): string {
        return this.asset2;
    }
    public getExchange(): Exchange {
        return this.exchange;
    }
    public getSymbol(): string {
        return this.symbol;
    }
    public getHighestBid(): number {
        return this.bids.getMaxNode().key;
    }
    public getLowestAsk(): number {
        return this.asks.getMinNode().key;
    }
    public updateAsks(price: number, amount: number) {
        // this.testMapQueue.insert(price, amount);
        if (amount == 0) this.asks.delete(price);
        else this.asks.insert(price, amount); //insert or update
    }

    public updateBids(price: number, amount: number) {
        if (amount == 0) this.bids.delete(price);
        else this.bids.insert(price, amount); //insert or update
    }

    /*
        Only 1 iterator -> non parallel reads 
        For parallel -> return new Iterator<number>(tree)
    */
    public getAskIterator(): MinRBIterator<number> {
        this.askIterator.restart();
        return this.askIterator;
    }

    public getBidIterator(): MaxRBIterator<number> {
        this.bidIterator.restart();
        return this.bidIterator;
    }
    public getMakerFee(): number {
        return this.makerFee;
    }
    public getTakerFee(): number {
        return this.takerFee;
    }
    public setMakerFee(fee: number) {
        this.makerFee = fee;
    }
    public setTakerFee(fee: number) {
        this.takerFee = fee;
    }

    public getReceivingAsset(side: OrderSide): string {
        if (side == OrderSide.BUY) return this.asset1;
        return this.asset2;
    }

    public getInAsset(side: OrderSide): string {
        if (side == OrderSide.BUY) return this.asset2;
        return this.asset1;
    }
    public getFirst(side: OrderSide): { price: number; amount: number } {
        if (side == OrderSide.BUY) {
            let node = this.asks.getMinNode();
            return { price: node.key, amount: node.value };
        } else {
            let node = this.bids.getMaxNode();
            return { price: node.key, amount: node.value };
        }
    }

    public getIsReady(): boolean {
        return this.isReady;
    }
    public setIsReady(ready: boolean) {
        this.isReady = ready;
    }

    public getSimulatedExecution(side: OrderSide, inAssetAmount: number = 0, onlyFirstPriceLevel: boolean = false): SimulateOrder {
        if (inAssetAmount < 0) throw new Error('OrderBook - getSimulatedExecution - inAssetAmount<0');
        let orders: PrepareOrder[] = [];
        if (!inAssetAmount) {
            let obj = this.getFirst(side);
            let receivedAmount = side == OrderSide.BUY ? obj.amount : obj.amount * obj.price;
            orders.push({ price: obj.price, amount: obj.amount, side, symbol: this.getSymbol(), exchange: this.exchange });
            return { avgPrice: obj.price, receivedAssetAmount: receivedAmount, orders };
        }
        let receivedAssetAmount = 0;
        let remaining = inAssetAmount;
        let avgPrice;
        if (side == OrderSide.BUY) {
            let it = this.getAskIterator();
            let priceLevel: Node<number>;
            while (remaining && it.hasNext()) {
                priceLevel = it.next(); //key=price value=amount
                let amount = SafeMath.div(remaining, priceLevel.key);
                //if (level.amount >= remaining/price)
                if (priceLevel.value >= amount) {
                    orders.push({ price: priceLevel.key, amount, side, symbol: this.getSymbol(), exchange: this.exchange });
                    // received +=remaining/level.price
                    receivedAssetAmount = SafeMath.add(receivedAssetAmount, amount);
                    remaining = 0;
                } else {
                    //level.amount < remaining/price
                    orders.push({ price: priceLevel.key, amount: priceLevel.value, side, symbol: this.getSymbol(), exchange: this.exchange });
                    //received += level.amount;
                    receivedAssetAmount = SafeMath.add(receivedAssetAmount, priceLevel.value);
                    //remaining -= level.amount*level.price;
                    remaining = SafeMath.sub(remaining, SafeMath.mul(priceLevel.value, priceLevel.key));
                }
                if (onlyFirstPriceLevel) break;
            }
            avgPrice = onlyFirstPriceLevel ? priceLevel.key : SafeMath.div(inAssetAmount - remaining, receivedAssetAmount);
        } else {
            //side == SELL
            let it = this.getBidIterator();
            let priceLevel: Node<number>;
            while (remaining && it.hasNext()) {
                priceLevel = it.next();
                //if(level.amount >= remaining)
                if (priceLevel.value >= remaining) {
                    orders.push({ price: priceLevel.key, amount: remaining, side, symbol: this.getSymbol(), exchange: this.exchange });
                    //received += remaining*level.price
                    receivedAssetAmount = SafeMath.add(receivedAssetAmount, SafeMath.mul(remaining, priceLevel.key));
                    remaining = 0;
                } else {
                    //level.amount < remaining
                    orders.push({ price: priceLevel.key, amount: priceLevel.value, side, symbol: this.getSymbol(), exchange: this.exchange });
                    //received += level.amount*level.price
                    receivedAssetAmount = SafeMath.add(receivedAssetAmount, SafeMath.mul(priceLevel.value, priceLevel.key));
                    remaining = SafeMath.sub(remaining, priceLevel.value);
                }
                if (onlyFirstPriceLevel) break;
            }
            avgPrice = onlyFirstPriceLevel ? priceLevel.key : SafeMath.div(receivedAssetAmount, inAssetAmount - remaining);
        }

        return { avgPrice, receivedAssetAmount, orders };
    }
    public printFirst() {
        let ask = this.asks.getMinNode().key;
        let bid = this.bids.getMaxNode().key;
        if (bid > ask) throw new Error('OrderBook - bid > ask');
        console.log('---------------');
        console.log(this.symbol);
        console.log('Ask', ask);
        console.log('Bid', bid);
        console.log('---------------');
    }
}

export default OrderBook;
