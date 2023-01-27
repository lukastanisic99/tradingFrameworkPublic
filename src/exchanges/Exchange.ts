import OrderBook from '../OrderBook';
import Order, { OrderStatus } from '../Order';
import path from 'path';
import Account from '../Account';
import Logger from '../Logger';
abstract class Exchange {
    protected orderBookMap: Map<string, OrderBook> = new Map<string, OrderBook>();
    protected account: Account;
    protected orderMap: Map<string, Order> = new Map<string, Order>();
    protected tickersJSON; // ClassName.json

    protected constructor(name: string) {
        this.tickersJSON = require('../../tickers/' + name + '.json');
        this.account = new Account();
    }
    // protected abstract initAsync(): Promise<void>;
    protected abstract _executeOrderAsync(order: Order): Promise<boolean>;
    public abstract cancelOrderAsync(order: Order): Promise<boolean>;
    // public abstract sellAsync(order:Order):Promise<boolean>;
    public abstract observe(pair: string): OrderBook;
    /**
     * Modifies the order to satisify all filters - if anything goes wrong return null
     */
    public abstract applyFilters(order: Order): Order;

    public getAccount(): Account {
        return this.account;
    }

    public getTickersJSON() {
        return this.tickersJSON;
    }

    public async executeOrderAsync(order: Order): Promise<boolean> {
        try {
            return await this._executeOrderAsync(order);
        } catch (e) {
            console.log(e);
            Logger.logError(order.toString() + '\n' + e.toString());
            order.update(OrderStatus.CANCELLED);
        }
        return false;
    }
}

export default Exchange;
